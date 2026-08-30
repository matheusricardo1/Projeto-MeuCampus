import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { AuthenticationError } from '@/domain/exceptions/authentication.error';
import { ExternalServiceError } from '@/domain/exceptions/external-service.error';
import { RestaurantNotSelectedError } from '@/domain/exceptions/restaurant-not-selected.error';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';
import type { RuDigitalActionResolver } from '@/infrastructure/ru-digital-portal/ru-digital-action-resolver';
import { parseFlightPayload } from '@/infrastructure/ru-digital-portal/parse-flight-payload';
import { formatCpf } from '@/infrastructure/ru-digital-portal/format-cpf';
import { extractRestaurantList, type RawRestaurant } from '@/infrastructure/ru-digital-portal/extract-restaurant-list';

const SESSION_COOKIE_NAME = 'session_token';
const RESTAURANT_COOKIE_NAME = 'restaurante_default_id';
const MAX_ATTEMPTS = 2;
const RESTAURANT_LIST_ROUTE = '/restaurante/select';

export interface RuDigitalSession {
    token: string;
    restaurantId?: string;
}

/**
 * Talks to RU Digital as plain HTTP + two session cookies — no browser, no
 * full cookie jar. RU Digital only ever sets `session_token` (the JWT) and,
 * once a restaurant is picked, `restaurante_default_id` — the preference is
 * per-cookie, not stored server-side per account, so a fresh session always
 * starts without one even if it was chosen before on another device.
 */
export class RuDigitalClient {
    private static readonly DEFAULT_TIMEOUT_MS = 15000;
    private static readonly LOGIN_TIMEOUT_MS = 20000;
    private readonly baseUrl = 'https://rudigital.ufam.edu.br';
    private readonly http: AxiosInstance;
    private token: string | undefined;
    private restaurantId: string | undefined;

    constructor(private readonly resolver: RuDigitalActionResolver) {
        this.assertHttpsBaseUrl();
        this.http = axios.create({
            baseURL: this.baseUrl,
            timeout: RuDigitalClient.DEFAULT_TIMEOUT_MS,
            family: 4,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0'
            }
        });
    }

    private assertHttpsBaseUrl(): void {
        if (new URL(this.baseUrl).protocol !== 'https:') {
            throw new Error('RU Digital integration must use HTTPS.');
        }
    }

    get isAuthenticated(): boolean {
        return Boolean(this.token);
    }

    exportSession(): RuDigitalSession {
        if (!this.token) {
            throw new AuthenticationError('No active RU Digital session to export.');
        }
        return this.restaurantId ? { token: this.token, restaurantId: this.restaurantId } : { token: this.token };
    }

    importSession(session: RuDigitalSession): void {
        this.token = session.token;
        this.restaurantId = session.restaurantId;
    }

    async login(cpf: string, password: string): Promise<void> {
        logger.info('Attempting RU Digital authentication.');

        const form = new FormData();
        form.append('1_username', formatCpf(cpf));
        form.append('1_password', password);
        form.append('0', JSON.stringify(['$undefined', '$K1']));

        const response = await this.postAction('/login', 'loginAction', form, { timeout: RuDigitalClient.LOGIN_TIMEOUT_MS });
        const token = this.extractSessionToken(response);

        if (!token) {
            logger.error('RU Digital authentication failed: no session cookie in response.');
            throw new AuthenticationError('CPF ou senha invalidos.');
        }

        this.token = token;
        logger.info('RU Digital authentication successful.');
    }

    async callAction<T>(route: string, actionName: string, body: unknown): Promise<T> {
        this.ensureAuthenticated();

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const hash = await this.resolver.resolveHash(route, actionName, this.buildCookieHeader().Cookie);
            const response = await this.postAction(route, actionName, JSON.stringify(body), {}, hash);

            if (response.status === 401 || response.status === 403) {
                this.token = undefined;
                throw new AuthenticationError('Sua sessao do RU Digital expirou. Entre novamente.');
            }

            // A 303 here is Next.js's own `redirect()` response to a server
            // action (e.g. no default restaurant chosen yet on a fresh
            // login) — a legitimate app state, not a stale/broken action.
            // Never worth invalidating the resolved hash or retrying for.
            if (response.status === 303) {
                throw new RestaurantNotSelectedError();
            }

            try {
                if (response.status !== 200) {
                    throw new ExternalServiceError(`RU Digital returned HTTP ${response.status} for action "${actionName}".`);
                }

                return parseFlightPayload<T>(response.data);
            } catch (error) {
                const isLastAttempt = attempt === MAX_ATTEMPTS;
                if (isLastAttempt) {
                    throw error;
                }

                logger.warning(`RU Digital action "${actionName}" failed, invalidating its cached hash and retrying once.`, {
                    route,
                    status: response.status,
                    errorName: error instanceof Error ? error.name : 'UnknownError'
                });
                await this.resolver.invalidate(route);
            }
        }

        // Unreachable — the loop above always either returns or throws.
        throw new ExternalServiceError(`RU Digital action "${actionName}" failed after ${MAX_ATTEMPTS} attempts.`);
    }

    /** Best-effort logout — a failure here shouldn't block clearing the local session. */
    async logout(): Promise<void> {
        try {
            await this.callAction('/home/dashboard', 'logoutAction', []);
        } catch (error) {
            logger.warning('RU Digital logout call failed; clearing local session anyway.', {
                errorName: error instanceof Error ? error.name : 'UnknownError'
            });
        } finally {
            this.token = undefined;
            this.restaurantId = undefined;
        }
    }

    /**
     * Reads the full list of university restaurants — server-rendered
     * directly into the page's initial RSC payload (no Server Action call
     * involved), so this is a plain authenticated GET + regex extraction.
     */
    async listRestaurants(): Promise<RawRestaurant[]> {
        this.ensureAuthenticated();

        const response = await this.http.get<string>(RESTAURANT_LIST_ROUTE, {
            params: { _rsc: '1' },
            headers: {
                Accept: 'text/x-component',
                RSC: '1',
                ...this.buildCookieHeader()
            }
        });

        if (response.status !== 200) {
            throw new ExternalServiceError(`RU Digital returned HTTP ${response.status} while listing restaurants.`);
        }

        return extractRestaurantList(typeof response.data === 'string' ? response.data : '');
    }

    /**
     * `selectDefaultRuAction` is bound via React's `useActionState`, so every
     * call — regardless of transport — carries the hook's previous-state
     * slot as its first argument (serialized as the literal "$undefined" on
     * first invocation) followed by the real payload. On success RU Digital
     * responds with a redirect (303) and a Set-Cookie for the preference —
     * a legitimate outcome here, unlike the same 303 on a read call.
     */
    async selectDefaultRestaurant(restaurantId: string): Promise<void> {
        this.ensureAuthenticated();

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const hash = await this.resolver.resolveHash(RESTAURANT_LIST_ROUTE, 'selectDefaultRuAction', this.buildCookieHeader().Cookie);
            const response = await this.postAction(
                RESTAURANT_LIST_ROUTE,
                'selectDefaultRuAction',
                JSON.stringify(['$undefined', { restauranteId: restaurantId }]),
                {},
                hash
            );

            if (response.status === 401 || response.status === 403) {
                this.token = undefined;
                throw new AuthenticationError('Sua sessao do RU Digital expirou. Entre novamente.');
            }

            if (response.status === 303) {
                this.restaurantId = restaurantId;
                return;
            }

            const isLastAttempt = attempt === MAX_ATTEMPTS;
            if (isLastAttempt) {
                throw new ExternalServiceError(`RU Digital returned HTTP ${response.status} while selecting the restaurant.`);
            }

            logger.warning('RU Digital "selectDefaultRuAction" failed, invalidating its cached hash and retrying once.', {
                status: response.status
            });
            await this.resolver.invalidate(RESTAURANT_LIST_ROUTE);
        }
    }

    private buildCookieHeader(): { Cookie?: string } {
        const cookies = [
            this.token ? `${SESSION_COOKIE_NAME}=${this.token}` : undefined,
            this.restaurantId ? `${RESTAURANT_COOKIE_NAME}=${this.restaurantId}` : undefined
        ].filter(Boolean);

        return cookies.length ? { Cookie: cookies.join('; ') } : {};
    }

    private async postAction(
        route: string,
        actionName: string,
        body: unknown,
        options: { timeout?: number } = {},
        knownHash?: string
    ): Promise<AxiosResponse> {
        const hash = knownHash ?? await this.resolver.resolveHash(route, actionName);
        const isForm = body instanceof FormData;

        return this.http.post(route, body, {
            timeout: options.timeout ?? RuDigitalClient.DEFAULT_TIMEOUT_MS,
            headers: {
                'next-action': hash,
                Accept: 'text/x-component',
                ...(isForm ? {} : { 'Content-Type': 'text/plain;charset=UTF-8' }),
                ...this.buildCookieHeader()
            }
        });
    }

    private ensureAuthenticated(): void {
        if (!this.token) {
            throw new AuthenticationError('Sua sessao do RU Digital expirou. Entre novamente.');
        }
    }

    private extractSessionToken(response: AxiosResponse): string | undefined {
        const rawCookies = response.headers['set-cookie'];
        const cookies = Array.isArray(rawCookies) ? rawCookies : (rawCookies ? [rawCookies] : []);

        for (const cookie of cookies) {
            const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
            if (match?.[1]) {
                return match[1];
            }
        }

        return undefined;
    }
}

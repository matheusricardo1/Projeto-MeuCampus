import { Platform } from 'react-native';
import { RuDigitalAuthSessionStore } from '@/shared/auth/ru-digital-auth-session-store';
import { RuDigitalSessionExpiredError } from '@/modules/ru-digital/domain/errors/ru-digital-session-expired.error';
import { RuDigitalResourcePendingError } from '@/modules/ru-digital/domain/errors/ru-digital-resource-pending.error';
import type { RuDigitalStudent } from '@/modules/ru-digital/domain/entities/student';
import type { RuDigitalBalance } from '@/modules/ru-digital/domain/entities/balance';
import type { RuDigitalDailyMenu } from '@/modules/ru-digital/domain/entities/daily-menu';
import type { RuDigitalRestaurant } from '@/modules/ru-digital/domain/entities/restaurant';
import type { RuDigitalLastConsumption } from '@/modules/ru-digital/domain/entities/last-consumption';
import type { AuthSession } from '@/shared/auth/auth-session';

const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';
const REQUEST_TIMEOUT_MS = 20000;

/**
 * Self-contained authenticated client for the RU Digital endpoints. Mirrors
 * AnnouncementsHttpClient's base-URL + Bearer-auth + pending-poll behaviour,
 * but against RU Digital's own separate session (see RuDigitalAuthSessionStore) —
 * the same NestJS API, a different login/token than eCampus's.
 */
export class RuDigitalHttpClient {
    private readonly baseUrl: string;
    private readonly sessionStore = new RuDigitalAuthSessionStore();

    constructor(
        baseUrl: string = process.env.EXPO_PUBLIC_ECAMPUS_API_URL
            || process.env.NEXT_PUBLIC_ECAMPUS_API_URL
            || DEFAULT_API_BASE_URL
    ) {
        this.baseUrl = this.normalizeBaseUrl(baseUrl);
    }

    /** Logs in with the same CPF/password as eCampus and stores RU Digital's own session. */
    async login(cpf: string, password: string): Promise<AuthSession> {
        const payload = await this.request<{ accessToken: string }>('/ru-digital/login', {
            method: 'POST',
            body: JSON.stringify({ cpf, password }),
            skipAuth: true
        });

        const session: AuthSession = { accessToken: payload.accessToken, tokenType: 'Bearer' };
        await this.sessionStore.save(session);
        return session;
    }

    async logout(): Promise<void> {
        try {
            await this.request('/ru-digital/logout', { method: 'POST' });
        } finally {
            await this.sessionStore.clear();
        }
    }

    async isLoggedIn(): Promise<boolean> {
        return Boolean(await this.sessionStore.get());
    }

    async getStudent(): Promise<RuDigitalStudent> {
        return this.requestResource<RuDigitalStudent>('/ru-digital/student', 'student');
    }

    async getBalance(): Promise<RuDigitalBalance> {
        return this.requestResource<RuDigitalBalance>('/ru-digital/balance', 'balance');
    }

    async getDailyMenu(date: string): Promise<RuDigitalDailyMenu> {
        return this.requestResource<RuDigitalDailyMenu>(`/ru-digital/daily-menu?date=${encodeURIComponent(date)}`, 'daily-menu');
    }

    async getDefaultRestaurant(): Promise<RuDigitalRestaurant> {
        return this.requestResource<RuDigitalRestaurant>('/ru-digital/restaurant', 'default-restaurant');
    }

    async getLastConsumption(restaurantId: string): Promise<RuDigitalLastConsumption> {
        return this.requestResource<RuDigitalLastConsumption>(`/ru-digital/last-consumption?restaurantId=${encodeURIComponent(restaurantId)}`, 'last-consumption');
    }

    async listRestaurants(): Promise<RuDigitalRestaurant[]> {
        return this.requestResource<RuDigitalRestaurant[]>('/ru-digital/restaurants', 'restaurant-list');
    }

    /** Selects the default restaurant and swaps in the fresh token the API returns (the choice lives inside the RU Digital session). */
    async selectRestaurant(restaurantId: string): Promise<void> {
        const payload = await this.request<{ accessToken: string }>('/ru-digital/restaurant/select', {
            method: 'POST',
            body: JSON.stringify({ restaurantId })
        });

        await this.sessionStore.save({ accessToken: payload.accessToken, tokenType: 'Bearer' });
    }

    private async requestResource<T>(path: string, resource: string): Promise<T> {
        return this.request<T>(path, { pendingResource: resource });
    }

    private async request<T>(path: string, options: {
        method?: string;
        body?: string;
        skipAuth?: boolean;
        pendingResource?: string;
    } = {}): Promise<T> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        if (!options.skipAuth) {
            const session = await this.sessionStore.get();
            if (!session) {
                throw new RuDigitalSessionExpiredError('Sua sessao do RU Digital nao foi encontrada.');
            }
            headers.Authorization = `Bearer ${session.accessToken}`;
        }

        const timeoutController = new AbortController();
        const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}${path}`, {
                method: options.method ?? 'GET',
                headers,
                body: options.body,
                ...(typeof window !== 'undefined' ? { cache: 'no-store' as RequestCache } : {}),
                signal: timeoutController.signal
            });
        } catch {
            throw new Error('Sem conexao com a internet. Verifique sua rede e tente novamente.');
        } finally {
            clearTimeout(timeout);
        }

        const bodyText = await response.text();
        const payload: unknown = bodyText ? safeJsonParse(bodyText) : null;

        if (response.status === 202 && isPlainObject(payload) && payload.status === 'pending' && options.pendingResource) {
            throw new RuDigitalResourcePendingError(options.pendingResource);
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new RuDigitalSessionExpiredError('Sua sessao do RU Digital expirou. Entre novamente.');
            }
            const message = isPlainObject(payload) && typeof payload.message === 'string'
                ? payload.message
                : 'Nao foi possivel completar a operacao no RU Digital.';
            throw new Error(message);
        }

        return payload as T;
    }

    private normalizeBaseUrl(baseUrl: string): string {
        try {
            return new URL(baseUrl).toString().replace(/\/+$/, '');
        } catch {
            return DEFAULT_API_BASE_URL;
        }
    }
}

function safeJsonParse(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { AuthenticationError } from '@ecampus/domain/errors/authentication.error';
import { logger } from '@ecampus/infrastructure/logging/console-logger';

export class EcampusClient {
    private static readonly LOGIN_TIMEOUT_MS = 25000;
    private static readonly DEFAULT_TIMEOUT_MS = 15000;
    private readonly baseUrl = 'https://ecampus.ufam.edu.br/ecampus';
    private readonly session: AxiosInstance;
    private jar: CookieJar;
    private authenticated = false;

    constructor() {
        this.assertHttpsBaseUrl();
        this.jar = new CookieJar();

        const client = axios.create({
            baseURL: this.baseUrl,
            withCredentials: true,
            // The Docker network has no IPv6 route. Prefer the public IPv4 endpoint
            // without replacing the agent managed by axios-cookiejar-support.
            family: 4,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        this.session = wrapper(client);
        this.session.defaults.jar = this.jar;
    }

    private assertHttpsBaseUrl(): void {
        const url = new URL(this.baseUrl);
        if (url.protocol !== 'https:') {
            throw new Error("eCampus integration must use HTTPS.");
        }
    }

    get isAuthenticated(): boolean {
        return this.authenticated;
    }

    exportCookies(): Record<string, unknown> {
        return this.jar.toJSON() ?? {};
    }

    importCookies(cookieDict: Record<string, unknown>): void {
        this.jar = CookieJar.fromJSON(cookieDict as any) || new CookieJar();
        this.session.defaults.jar = this.jar;
        this.authenticated = true;
        logger.info("Cookies loaded into the session.");
    }

    async login(cpf: string, password: string): Promise<void> {
        const params = new URLSearchParams();
        params.append('usuario', cpf);
        params.append('senha', password);
        params.append('enviar', 'Entrar');

        logger.info("Attempting eCampus authentication.");

        try {
            const response = await this.withExternalRetry(
                'login',
                () => this.session.post('/home/loginValida', params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: EcampusClient.LOGIN_TIMEOUT_MS
                })
            );

            const html = response.data;
            if (typeof html === 'string' && html.includes('Acesso ecampus')) {
                this.authenticated = false;
                logger.error("Authentication failed: Invalid credentials.");
                throw new AuthenticationError('CPF ou senha invalidos.');
            }

            this.authenticated = true;
            logger.info("Authentication successful.");

            try {
                await this.setStudentModule();
            } catch (error) {
                logger.warning("Unable to activate the default student module. Continuing with the authenticated session.", this.toErrorContext(error, '/home/setModulo/22'));
            }
        } catch (error) {
            if (error instanceof AuthenticationError) {
                throw error;
            }

            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Connection error during login: ${message}`, this.toErrorContext(error, '/home/loginValida'));
            throw error;
        }
    }

    async setStudentModule(moduleId: number = 22): Promise<void> {
        logger.info(`Changing context to module ID: ${moduleId}`);
        try {
            await this.withExternalRetry(
                `module activation ${moduleId}`,
                () => this.session.get(`/home/setModulo/${moduleId}`, { timeout: EcampusClient.DEFAULT_TIMEOUT_MS })
            );
        } catch (error) {
            logger.error("Failed to activate student module.", this.toErrorContext(error, `/home/setModulo/${moduleId}`));
            throw error;
        }

        logger.info(`Module ${moduleId} activated.`);
    }

    async logout(): Promise<void> {
        try {
            const response = await this.session.get('/home/logout', {
                maxRedirects: 0,
                timeout: EcampusClient.DEFAULT_TIMEOUT_MS,
                validateStatus: (status) => status === 302 || status === 200
            });

            this.authenticated = false;
            logger.info("eCampus logout completed.", {
                externalStatus: response.status,
                location: response.headers.location
            });
        } catch (error) {
            logger.error("Failed to logout from eCampus.", this.toErrorContext(error, '/home/logout'));
            throw error;
        }
    }

    async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        this.ensureAuthenticated();
        try {
            const response = await this.session.get<T>(url, config);
            this.assertAuthenticatedResponse(response, url);
            return response;
        } catch (error) {
            this.assertAuthenticatedError(error, url);
            throw error;
        }
    }

    async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        this.ensureAuthenticated();
        try {
            const response = await this.session.post<T>(url, data, config);
            this.assertAuthenticatedResponse(response, url);
            return response;
        } catch (error) {
            this.assertAuthenticatedError(error, url);
            throw error;
        }
    }

    private ensureAuthenticated(): void {
        if (!this.authenticated) {
            throw new AuthenticationError('Sua sessao expirou. Entre novamente.');
        }
    }

    private assertAuthenticatedResponse(response: AxiosResponse<unknown>, fallbackUrl: string): void {
        const responseUrl = this.getResponseUrl(response) || fallbackUrl;
        const body = typeof response.data === 'string' ? response.data : '';
        const redirectedToLogin = /\/home\/login(?:Valida)?/i.test(responseUrl);
        const returnedLoginPage = body.includes('loginValida') || body.includes('Acesso ecampus');

        if ([401, 403].includes(response.status) || redirectedToLogin || returnedLoginPage) {
            this.authenticated = false;
            throw new AuthenticationError('Sua sessao expirou. Entre novamente.');
        }
    }

    private assertAuthenticatedError(error: unknown, fallbackUrl: string): void {
        if (!(error instanceof AxiosError)) {
            return;
        }

        if (!error.response) {
            return;
        }

        this.assertAuthenticatedResponse(error.response, error.config?.url || fallbackUrl);
    }

    private async withExternalRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
        const maxAttempts = 2;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                return await operation();
            } catch (error) {
                const shouldRetry = this.shouldRetry(error) && attempt < maxAttempts;

                if (!shouldRetry) {
                    throw error;
                }

                logger.warning(`eCampus timed out or failed while performing ${label}. Retrying once...`, {
                    ...this.toErrorContext(error, label)
                });

                await this.delay(700);
            }
        }

        throw new Error(`Unable to complete ${label}.`);
    }

    private shouldRetry(error: unknown): boolean {
        const networkErrors = this.getNetworkErrors(error);
        if (networkErrors.some(({ code }) => code && [
            'ECONNABORTED', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT'
        ].includes(code))) {
            return true;
        }

        if (!(error instanceof AxiosError)) return false;

        if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) {
            return true;
        }

        return (error.response?.status || 0) >= 500;
    }

    private delay(milliseconds: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    private toErrorContext(error: unknown, fallbackUrl: string): Record<string, unknown> {
        const networkErrors = this.getNetworkErrors(error);

        if (error instanceof AxiosError) {
            return {
                url: error.config?.url || fallbackUrl,
                method: error.config?.method?.toUpperCase(),
                externalStatus: error.response?.status,
                externalStatusText: error.response?.statusText,
                code: error.code,
                networkErrors: networkErrors.length ? networkErrors : undefined,
                location: this.getStackLocation(error.stack)
            };
        }

        if (error instanceof Error) {
            return {
                url: fallbackUrl,
                errorName: error.name,
                networkErrors: networkErrors.length ? networkErrors : undefined,
                location: this.getStackLocation(error.stack)
            };
        }

        return { url: fallbackUrl };
    }

    private getNetworkErrors(error: unknown): Array<{ code: string | undefined; message: string }> {
        if (error instanceof AggregateError) {
            return error.errors
                .filter((entry): entry is Error => entry instanceof Error)
                .map((entry) => ({
                    code: (entry as NodeJS.ErrnoException).code,
                    message: entry.message
                }));
        }

        if (error instanceof Error) {
            return [{
                code: (error as NodeJS.ErrnoException).code,
                message: error.message
            }];
        }

        return [];
    }

    private getStackLocation(stack?: string): string | undefined {
        if (!stack) return undefined;
        return stack.split('\n').find((line) => line.includes('src\\') || line.includes('src/'))?.trim();
    }

    private getResponseUrl(response: AxiosResponse<unknown>): string | undefined {
        const request = response.request as { res?: { responseUrl?: string } } | undefined;
        return request?.res?.responseUrl;
    }
}

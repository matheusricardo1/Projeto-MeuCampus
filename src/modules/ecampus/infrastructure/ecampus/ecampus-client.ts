import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { AuthenticationError } from '@ecampus/domain/errors/authentication.error';
import { logger } from '@ecampus/infrastructure/logging/console-logger';

export class EcampusClient {
    private readonly baseUrl = 'https://ecampus.ufam.edu.br/ecampus';
    private readonly session: AxiosInstance;
    private jar: CookieJar;
    private authenticated = false;

    constructor() {
        this.jar = new CookieJar();

        const client = axios.create({
            baseURL: this.baseUrl,
            withCredentials: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        this.session = wrapper(client);
        this.session.defaults.jar = this.jar;
    }

    get isAuthenticated(): boolean {
        return this.authenticated;
    }

    exportCookies(): object {
        return this.jar.toJSON() ?? {};
    }

    importCookies(cookieDict: object): void {
        this.jar = CookieJar.fromJSON(cookieDict as any) || new CookieJar();
        this.session.defaults.jar = this.jar;
        logger.info("Cookies loaded into the session.");
    }

    async isSessionAlive(): Promise<boolean> {
        try {
            const response = await this.session.get('/home/index', {
                maxRedirects: 0,
                validateStatus: (status) => status < 400
            });

            this.authenticated = response.status === 200 && !String(response.data).includes('loginValida');

            if (this.authenticated) {
                logger.info("Session is alive and valid.");
                return true;
            }

            logger.warning("Session has expired or is invalid.");
            return false;
        } catch (error) {
            this.authenticated = false;
            logger.warning("Session check failed or expired.", this.toErrorContext(error, '/home/index'));
            return false;
        }
    }

    async login(cpf: string, password: string): Promise<void> {
        const params = new URLSearchParams();
        params.append('usuario', cpf);
        params.append('senha', password);
        params.append('enviar', 'Entrar');

        logger.info(`Attempting authentication for user: ${cpf}`);

        try {
            const response = await this.session.post('/home/loginValida', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 10000
            });

            const requestPath = (response.request as { path?: string } | undefined)?.path;
            const html = response.data;
            if (typeof html === 'string' && (html.includes('Acesso ecampus') || requestPath?.includes('loginValida'))) {
                this.authenticated = false;
                logger.error("Authentication failed: Invalid credentials.");
                throw new AuthenticationError("Invalid CPF or password.");
            }

            this.authenticated = true;
            logger.info("Authentication successful.");

            await this.setStudentModule();
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
            await this.session.get(`/home/setModulo/${moduleId}`, { timeout: 10000 });
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
                timeout: 10000,
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
        return this.session.get<T>(url, config);
    }

    async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        this.ensureAuthenticated();
        return this.session.post<T>(url, data, config);
    }

    private ensureAuthenticated(): void {
        if (!this.authenticated) {
            throw new AuthenticationError("Attempted to access protected route without auth.");
        }
    }

    private toErrorContext(error: unknown, fallbackUrl: string): Record<string, unknown> {
        if (error instanceof AxiosError) {
            return {
                url: error.config?.url || fallbackUrl,
                method: error.config?.method?.toUpperCase(),
                externalStatus: error.response?.status,
                externalStatusText: error.response?.statusText,
                location: this.getStackLocation(error.stack)
            };
        }

        if (error instanceof Error) {
            return {
                url: fallbackUrl,
                errorName: error.name,
                location: this.getStackLocation(error.stack)
            };
        }

        return { url: fallbackUrl };
    }

    private getStackLocation(stack?: string): string | undefined {
        if (!stack) return undefined;
        return stack.split('\n').find((line) => line.includes('src\\') || line.includes('src/'))?.trim();
    }
}

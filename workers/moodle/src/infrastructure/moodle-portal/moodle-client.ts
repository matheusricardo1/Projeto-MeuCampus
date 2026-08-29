import axios, { type AxiosInstance } from 'axios';
import { AuthenticationError } from '@/domain/exceptions/authentication.error';
import { ExternalServiceError } from '@/domain/exceptions/external-service.error';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';
import { resolveMoodleInstance, type MoodleInstanceId } from '@/config/moodle-instances';

const DEFAULT_TIMEOUT_MS = 15000;
const LOGIN_TIMEOUT_MS = 20000;
const MOBILE_SERVICE = 'moodle_mobile_app';

export interface MoodleSession {
    token: string;
}

type UnknownRecord = Record<string, unknown>;

/**
 * Talks to a Moodle instance's official mobile web service API
 * (`login/token.php` + `webservice/rest/server.php`) — no scraping, no
 * cookie jar, no browser. The instance is resolved from a fixed server-side
 * allow-list (see config/moodle-instances.ts); this client never accepts an
 * arbitrary base URL, and credentials always travel as a POST body, never a
 * querystring, so they can't end up in access logs or proxy history.
 */
export class MoodleClient {
    private readonly baseUrl: string;
    private readonly http: AxiosInstance;
    private token: string | undefined;

    constructor(private readonly instanceId: MoodleInstanceId) {
        this.baseUrl = resolveMoodleInstance(instanceId).baseUrl;
        this.assertHttpsBaseUrl();
        this.http = axios.create({
            baseURL: this.baseUrl,
            timeout: DEFAULT_TIMEOUT_MS,
            family: 4,
            validateStatus: () => true
        });
    }

    private assertHttpsBaseUrl(): void {
        if (new URL(this.baseUrl).protocol !== 'https:') {
            throw new Error(`Moodle instance "${this.instanceId}" must be reached over HTTPS.`);
        }
    }

    get isAuthenticated(): boolean {
        return Boolean(this.token);
    }

    exportSession(): MoodleSession {
        if (!this.token) {
            throw new AuthenticationError('No active Moodle session to export.');
        }
        return { token: this.token };
    }

    importSession(session: MoodleSession): void {
        this.token = session.token;
    }

    async login(username: string, password: string): Promise<void> {
        logger.info('Attempting Moodle authentication.', { instanceId: this.instanceId });

        const form = new URLSearchParams({ username, password, service: MOBILE_SERVICE });
        const response = await this.http.post<UnknownRecord>('/login/token.php', form, {
            timeout: LOGIN_TIMEOUT_MS,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const token = typeof response.data?.token === 'string' ? response.data.token : undefined;
        if (!token) {
            const message = typeof response.data?.error === 'string' ? response.data.error : 'Identificacao ou senha invalidas.';
            logger.error('Moodle authentication failed.', { instanceId: this.instanceId });
            throw new AuthenticationError(message);
        }

        this.token = token;
        logger.info('Moodle authentication successful.', { instanceId: this.instanceId });
    }

    async call<T>(wsfunction: string, params: Record<string, string | number> = {}): Promise<T> {
        this.ensureAuthenticated();

        const form = new URLSearchParams({
            wstoken: this.token as string,
            wsfunction,
            moodlewsrestformat: 'json'
        });
        for (const [key, value] of Object.entries(params)) {
            form.append(key, String(value));
        }

        const response = await this.http.post<unknown>('/webservice/rest/server.php', form, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (response.status !== 200) {
            throw new ExternalServiceError(`Moodle (${this.instanceId}) returned HTTP ${response.status} for "${wsfunction}".`);
        }

        return this.unwrap<T>(response.data, wsfunction);
    }

    /**
     * Best-effort local cleanup. A student-scoped mobile token has no
     * self-service revocation endpoint in stock Moodle — actually revoking
     * it requires an admin. Clearing our own cached session (done by the
     * caller) is the practical equivalent from this side.
     */
    async logout(): Promise<void> {
        this.token = undefined;
    }

    private unwrap<T>(data: unknown, wsfunction: string): T {
        if (data && typeof data === 'object' && 'exception' in data) {
            const record = data as UnknownRecord;
            const errorCode = typeof record.errorcode === 'string' ? record.errorcode : 'unknown';
            const message = typeof record.message === 'string' ? record.message : 'Moodle web service error.';

            if (errorCode === 'invalidtoken' || errorCode === 'accessexception') {
                this.token = undefined;
                throw new AuthenticationError('Sua sessao do Moodle expirou. Entre novamente.');
            }

            logger.error('Moodle web service call failed.', { instanceId: this.instanceId, wsfunction, errorCode });
            throw new ExternalServiceError(`Moodle (${this.instanceId}) "${wsfunction}" failed: ${message}`);
        }

        return data as T;
    }

    private ensureAuthenticated(): void {
        if (!this.token) {
            throw new AuthenticationError('Sua sessao do Moodle expirou. Entre novamente.');
        }
    }
}

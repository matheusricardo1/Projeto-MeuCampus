import { Platform } from 'react-native';
import { AsyncAuthSessionStore } from '@/shared/auth/async-auth-session-store';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import type { MatrizCurricular } from '@/modules/academic/domain/entities/matriz-curricular';

const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';
const REQUEST_TIMEOUT_MS = 30000;

/** Thrown when the matrix isn't cached yet and a scrape was enqueued (HTTP 202).
 *  The caller should poll again shortly. */
export class MatrizPendingError extends Error {
    constructor() {
        super('Matriz sendo preparada.');
        this.name = 'MatrizPendingError';
    }
}

/**
 * Self-contained authenticated client for the curriculum matrix endpoint.
 * Mirrors CommunityHttpClient's base-URL + Bearer-auth behaviour, and treats a
 * 202 (pending scrape) as a distinct MatrizPendingError so the hook can poll.
 */
export class MatrizHttpClient {
    private readonly baseUrl: string;
    private readonly sessionStore = new AsyncAuthSessionStore();

    constructor(
        baseUrl: string = process.env.EXPO_PUBLIC_ECAMPUS_API_URL
            || process.env.NEXT_PUBLIC_ECAMPUS_API_URL
            || DEFAULT_API_BASE_URL
    ) {
        this.baseUrl = this.normalizeBaseUrl(baseUrl);
    }

    async getMatrizCurricular(): Promise<MatrizCurricular> {
        const session = await this.sessionStore.get();
        if (!session) {
            throw new AuthSessionExpiredError('Sua sessao expirou. Entre novamente.');
        }

        const timeoutController = new AbortController();
        const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}/ecampus/matriz-curricular`, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.accessToken}`
                },
                ...(typeof window !== 'undefined' ? { cache: 'no-store' as RequestCache } : {}),
                signal: timeoutController.signal
            });
        } catch {
            throw new Error('Sem conexao com a internet. Verifique sua rede e tente novamente.');
        } finally {
            clearTimeout(timeout);
        }

        const body = await response.text();
        const payload: unknown = body ? safeJsonParse(body) : null;

        if (response.status === 202 && isPlainObject(payload) && payload.status === 'pending') {
            throw new MatrizPendingError();
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthSessionExpiredError('Sua sessao expirou. Entre novamente.');
            }
            const message = isPlainObject(payload) && typeof payload.message === 'string'
                ? payload.message
                : 'Nao foi possivel carregar a matriz curricular.';
            throw new Error(message);
        }

        return payload as MatrizCurricular;
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

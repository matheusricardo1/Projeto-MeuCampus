import { Platform } from 'react-native';
import { AsyncAuthSessionStore } from '@/shared/auth/async-auth-session-store';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import type { EcampusAnnouncement } from '@/modules/academic/domain/entities/ecampus-announcement';

const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';
const REQUEST_TIMEOUT_MS = 30000;

/** Thrown when announcements aren't cached yet and a scrape was enqueued (HTTP 202).
 *  The caller should poll again shortly. */
export class AnnouncementsPendingError extends Error {
    constructor() {
        super('Avisos sendo carregados.');
        this.name = 'AnnouncementsPendingError';
    }
}

/**
 * Self-contained authenticated client for the eCampus announcements endpoint.
 * Mirrors MatrizHttpClient's base-URL + Bearer-auth + pending-poll behaviour.
 */
export class AnnouncementsHttpClient {
    private readonly baseUrl: string;
    private readonly sessionStore = new AsyncAuthSessionStore();

    constructor(
        baseUrl: string = process.env.EXPO_PUBLIC_ECAMPUS_API_URL
            || process.env.NEXT_PUBLIC_ECAMPUS_API_URL
            || DEFAULT_API_BASE_URL
    ) {
        this.baseUrl = this.normalizeBaseUrl(baseUrl);
    }

    async getAnnouncements(): Promise<EcampusAnnouncement[]> {
        const session = await this.sessionStore.get();
        if (!session) {
            throw new AuthSessionExpiredError('Sua sessao expirou. Entre novamente.');
        }

        const timeoutController = new AbortController();
        const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}/ecampus/announcements`, {
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
            throw new AnnouncementsPendingError();
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthSessionExpiredError('Sua sessao expirou. Entre novamente.');
            }
            const message = isPlainObject(payload) && typeof payload.message === 'string'
                ? payload.message
                : 'Nao foi possivel carregar os avisos.';
            throw new Error(message);
        }

        return Array.isArray(payload) ? (payload as EcampusAnnouncement[]) : [];
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

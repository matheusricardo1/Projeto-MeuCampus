import { Platform } from 'react-native';
import { AsyncAuthSessionStore } from '@/shared/auth/async-auth-session-store';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import type { CommunityCategory, CommunityPost, CreateCommunityPostInput } from '@/modules/community/domain/community-post';

const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';
const REQUEST_TIMEOUT_MS = 20000;

/**
 * Thin authenticated client for the Comunidade endpoints. Mirrors the base-URL
 * resolution and Bearer-auth behaviour of EcampusHttpRepository, kept local so
 * the community module stays self-contained.
 */
export class CommunityHttpClient {
    private readonly baseUrl: string;
    private readonly sessionStore = new AsyncAuthSessionStore();

    constructor(
        baseUrl: string = process.env.EXPO_PUBLIC_ECAMPUS_API_URL
            || process.env.NEXT_PUBLIC_ECAMPUS_API_URL
            || DEFAULT_API_BASE_URL
    ) {
        this.baseUrl = this.normalizeBaseUrl(baseUrl);
    }

    listPosts(category?: CommunityCategory): Promise<CommunityPost[]> {
        const query = category ? `?category=${encodeURIComponent(category)}` : '';
        return this.request<CommunityPost[]>(`/community/posts${query}`);
    }

    createPost(input: CreateCommunityPostInput): Promise<CommunityPost> {
        return this.request<CommunityPost>('/community/posts', {
            method: 'POST',
            body: JSON.stringify(input)
        });
    }

    confirmPost(id: string): Promise<{ confirmCount: number }> {
        return this.request<{ confirmCount: number }>(`/community/posts/${encodeURIComponent(id)}/confirm`, {
            method: 'POST'
        });
    }

    deletePost(id: string): Promise<void> {
        return this.request<{ status: string }>(`/community/posts/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        }).then(() => undefined);
    }

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const session = await this.sessionStore.get();
        if (!session) {
            throw new AuthSessionExpiredError('Sua sessao expirou. Entre novamente.');
        }

        const timeoutController = new AbortController();
        const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}${path}`, {
                ...init,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.accessToken}`,
                    ...init.headers
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

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthSessionExpiredError('Sua sessao expirou. Entre novamente.');
            }
            const message = isPlainObject(payload) && typeof payload.message === 'string'
                ? payload.message
                : 'Nao foi possivel concluir a solicitacao.';
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

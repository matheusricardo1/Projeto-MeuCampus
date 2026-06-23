import type { AuthSession } from '@/domain/entities/auth-session';
import type { AuthSessionStore } from '@/application/ports/auth-session-store';

let cachedSession: AuthSession | null = null;

export class AsyncAuthSessionStore implements AuthSessionStore {
    async get(): Promise<AuthSession | null> {
        return cachedSession;
    }

    async save(session: AuthSession): Promise<void> {
        cachedSession = session;
    }

    async clear(): Promise<void> {
        cachedSession = null;
    }
}

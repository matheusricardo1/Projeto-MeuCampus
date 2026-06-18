import type { AuthSession } from '@/domain/entities/auth-session';

export interface AuthSessionStore {
    get(): AuthSession | null;
    save(session: AuthSession): void;
    clear(): void;
}

import type { AuthSession } from '@/domain/entities/auth-session';

export interface AuthSessionStore {
    get(): Promise<AuthSession | null>;
    save(session: AuthSession): Promise<void>;
    clear(): Promise<void>;
}

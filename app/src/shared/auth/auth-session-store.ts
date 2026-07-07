import type { AuthSession } from '@/shared/auth/auth-session';

export interface AuthSessionStore {
    get(): Promise<AuthSession | null>;
    save(session: AuthSession): Promise<void>;
    clear(): Promise<void>;
}

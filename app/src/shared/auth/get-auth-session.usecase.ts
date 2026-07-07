import type { AuthSession } from '@/shared/auth/auth-session';
import type { AuthSessionStore } from '@/shared/auth/auth-session-store';

export class GetAuthSessionUseCase {
    constructor(private readonly sessionStore: AuthSessionStore) {}

    execute(): Promise<AuthSession | null> {
        return this.sessionStore.get();
    }
}

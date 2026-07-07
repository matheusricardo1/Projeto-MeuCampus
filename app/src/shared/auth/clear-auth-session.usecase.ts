import type { AuthSessionStore } from '@/shared/auth/auth-session-store';

export class ClearAuthSessionUseCase {
    constructor(private readonly sessionStore: AuthSessionStore) {}

    execute(): Promise<void> {
        return this.sessionStore.clear();
    }
}

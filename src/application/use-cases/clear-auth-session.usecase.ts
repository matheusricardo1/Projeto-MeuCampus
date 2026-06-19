import type { AuthSessionStore } from '@/application/ports/auth-session-store';

export class ClearAuthSessionUseCase {
    constructor(private readonly sessionStore: AuthSessionStore) {}

    execute(): void {
        this.sessionStore.clear();
    }
}

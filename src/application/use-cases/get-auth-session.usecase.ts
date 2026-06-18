import type { AuthSession } from '@/domain/entities/auth-session';
import type { AuthSessionStore } from '@/application/ports/auth-session-store';

export class GetAuthSessionUseCase {
    constructor(private readonly sessionStore: AuthSessionStore) {}

    execute(): AuthSession | null {
        return this.sessionStore.get();
    }
}

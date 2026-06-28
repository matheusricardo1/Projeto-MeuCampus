import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';

export class ValidateAuthSessionUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(): Promise<void> {
        const session = await this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();
        await this.repository.validateSession(session.accessToken);
    }
}

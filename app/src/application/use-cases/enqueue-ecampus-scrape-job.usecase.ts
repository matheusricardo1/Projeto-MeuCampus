import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import type { EcampusRepository, EcampusScrapeJobType } from '@/domain/repositories/ecampus-repository';

export class EnqueueEcampusScrapeJobUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(type: EcampusScrapeJobType, data?: Record<string, unknown>): Promise<void> {
        const session = await this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();
        await this.repository.enqueueScrapeJob(session.accessToken, type, data);
    }
}

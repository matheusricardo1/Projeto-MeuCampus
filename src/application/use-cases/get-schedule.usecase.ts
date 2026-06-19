import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { ScheduleClass } from '@/domain/entities/schedule-class';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';

export class GetScheduleUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(): Promise<ScheduleClass[]> {
        const session = this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();
        return this.repository.getSchedule(session.accessToken);
    }
}

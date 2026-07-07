import type { AuthSessionStore } from '@/shared/auth/auth-session-store';
import type { ScheduleClass } from '@/modules/academic/domain/entities/schedule-class';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import type { EcampusRepository } from '@/modules/academic/domain/repositories/ecampus-repository';

export class GetScheduleUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(): Promise<ScheduleClass[]> {
        const session = await this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();
        return this.repository.getSchedule(session.accessToken);
    }
}

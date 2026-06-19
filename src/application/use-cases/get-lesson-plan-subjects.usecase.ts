import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';

export class GetLessonPlanSubjectsUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(): Promise<LessonPlanSubject[]> {
        const session = this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();
        return this.repository.getLessonPlanSubjects(session.accessToken);
    }
}

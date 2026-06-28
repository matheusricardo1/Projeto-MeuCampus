import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';

export class GetLessonPlanSubjectsUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(year?: string, period?: string): Promise<LessonPlanSubject[]> {
        const session = await this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();
        return this.repository.getAcademicSubjects(session.accessToken, year, period);
    }
}

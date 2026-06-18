import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';

export class GetLessonPlanSubjectsUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(): Promise<LessonPlanSubject[]> {
        const session = this.sessionStore.get();
        if (!session) throw new Error('Sessao expirada.');
        return this.repository.getLessonPlanSubjects(session.accessToken);
    }
}

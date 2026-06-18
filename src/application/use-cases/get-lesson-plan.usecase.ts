import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { LessonPlanItem } from '@/domain/entities/lesson-plan-item';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';

export class GetLessonPlanUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(planId: string): Promise<LessonPlanItem[]> {
        const session = this.sessionStore.get();
        if (!session) throw new Error('Sessao expirada.');
        return this.repository.getLessonPlan(session.accessToken, planId);
    }
}

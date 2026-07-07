import type { AuthSessionStore } from '@/shared/auth/auth-session-store';
import type { LessonPlanItem } from '@/modules/academic/domain/entities/lesson-plan-item';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import type { EcampusRepository } from '@/modules/academic/domain/repositories/ecampus-repository';

export class GetLessonPlanUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(planId: string): Promise<LessonPlanItem[]> {
        const session = await this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();
        return this.repository.getLessonPlan(session.accessToken, planId);
    }
}

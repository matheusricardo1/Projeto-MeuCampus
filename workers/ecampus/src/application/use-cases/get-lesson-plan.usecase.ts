import type { EcampusRepository } from '@/domain/repositories/ecampus.repository';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { LessonPlanItem } from '@/domain/value-objects/lesson-plan-item';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

export class GetLessonPlanUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessions: EcampusSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: EcampusCredentials, planId: string | undefined): Promise<LessonPlanItem[]> {
        if (typeof planId !== 'string' || !planId.trim()) {
            throw new Error('Missing required job field: planId');
        }

        await this.sessions.assertActive(credentials.cpf);
        return this.cacheAndPublish.run(
            'lesson-plan',
            credentials.cpf,
            this.repository.getLessonPlan(credentials, planId),
            { planId }
        );
    }
}

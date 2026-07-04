import type { EcampusRepository } from '@/domain/repositories/ecampus.repository';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

export class GetLessonPlanSubjectsUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessions: EcampusSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: EcampusCredentials): Promise<LessonPlanSubject[]> {
        await this.sessions.assertActive(credentials.cpf);
        return this.cacheAndPublish.run('lesson-plan-subjects', credentials.cpf, this.repository.getLessonPlanSubjects(credentials));
    }
}

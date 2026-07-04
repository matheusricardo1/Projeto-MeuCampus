import type { EcampusRepository } from '@/domain/repositories/ecampus.repository';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { ScheduleClass } from '@/domain/value-objects/schedule-class';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

export class GetScheduleUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessions: EcampusSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: EcampusCredentials): Promise<ScheduleClass[]> {
        await this.sessions.assertActive(credentials.cpf);
        return this.cacheAndPublish.run('schedule', credentials.cpf, this.repository.getSchedule(credentials));
    }
}

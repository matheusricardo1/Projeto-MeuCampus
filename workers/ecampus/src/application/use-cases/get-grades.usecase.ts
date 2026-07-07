import type { EcampusRepository } from '@/domain/repositories/ecampus.repository';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { Grade } from '@/domain/entities/grade';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

export class GetGradesUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessions: EcampusSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: EcampusCredentials, requestedYear?: string, requestedPeriod?: string): Promise<Grade[]> {
        await this.sessions.assertActive(credentials.cpf);
        const { year, period } = requestedYear && requestedPeriod
            ? { year: requestedYear, period: requestedPeriod }
            : await this.repository.getCurrentPeriod(credentials);

        return this.cacheAndPublish.run(
            'grades',
            credentials.cpf,
            this.repository.getGrades(credentials, year, period),
            { year, period }
        );
    }
}

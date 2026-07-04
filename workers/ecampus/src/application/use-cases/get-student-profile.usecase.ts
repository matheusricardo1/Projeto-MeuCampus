import type { EcampusRepository } from '@/domain/repositories/ecampus.repository';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { StudentProfile } from '@/domain/entities/student-profile';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

export class GetStudentProfileUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessions: EcampusSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: EcampusCredentials): Promise<StudentProfile> {
        await this.sessions.assertActive(credentials.cpf);
        return this.cacheAndPublish.run('profile', credentials.cpf, this.repository.getStudentProfile(credentials));
    }
}

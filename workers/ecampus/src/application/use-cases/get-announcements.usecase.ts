import type { EcampusRepository } from '@/domain/repositories/ecampus.repository';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { EcampusAnnouncement } from '@/domain/value-objects/ecampus-announcement';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

/**
 * Fetches eCampus's institutional announcements ("Avisos"), scraped through
 * the requesting student's own session but identical for everyone — the API
 * layer is what turns this per-student scrape into a globally-shared cache
 * (see GetAnnouncementsUseCase on the api side, mirroring how matriz
 * curricular is cached per-course instead of per-student).
 */
export class GetAnnouncementsUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessions: EcampusSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: EcampusCredentials): Promise<EcampusAnnouncement[]> {
        await this.sessions.assertActive(credentials.cpf);
        return this.cacheAndPublish.run('announcements', credentials.cpf, this.repository.getAnnouncements(credentials));
    }
}

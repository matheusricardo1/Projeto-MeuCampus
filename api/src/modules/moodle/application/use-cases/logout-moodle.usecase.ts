import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { MoodleDataRepository } from '@moodle/domain/repositories/moodle-data.repository';
import { MoodleSessionRegistry } from '@moodle/application/ports/moodle-session-registry';
import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';
import { moodleIdentity } from '@moodle/application/services/moodle-identity';

export class LogoutMoodleUseCase {
    constructor(
        private readonly scrapingJobService: ScrapingJobService,
        private readonly cache: MoodleDataRepository,
        private readonly sessions: MoodleSessionRegistry
    ) {}

    async execute(credentials: MoodleCredentials): Promise<void> {
        const identity = moodleIdentity(credentials);
        await this.scrapingJobService.enqueue('logout', { credentials });
        await this.cache.clearUserCache(identity);
        await this.sessions.invalidate(identity);
    }
}

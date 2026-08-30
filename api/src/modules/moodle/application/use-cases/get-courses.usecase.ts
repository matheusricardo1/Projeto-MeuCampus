import { MoodleDataRepository } from '@moodle/domain/repositories/moodle-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';
import { MoodleResourceNotFoundException } from '@moodle/domain/exceptions/moodle-resource-not-found.exception';
import type { Course } from '@moodle/domain/entities/course.entity';
import { pendingScrapeJob, type PendingScrapeJob } from '@moodle/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@moodle/application/services/scraping-job-dedupe-key';
import { moodleIdentity } from '@moodle/application/services/moodle-identity';

export class GetCoursesUseCase {
    constructor(
        private readonly cache: MoodleDataRepository,
        private readonly scrapingJobService: ScrapingJobService
    ) {}

    async execute(credentials: MoodleCredentials): Promise<Course[] | PendingScrapeJob> {
        try {
            return await this.cache.getCourses(moodleIdentity(credentials));
        } catch (error) {
            if (!(error instanceof MoodleResourceNotFoundException)) {
                throw error;
            }

            await this.scrapingJobService.enqueue('courses', { credentials }, {
                dedupeKey: scrapingJobDedupeKey(credentials, 'moodle-courses')
            });
            return pendingScrapeJob('courses');
        }
    }
}

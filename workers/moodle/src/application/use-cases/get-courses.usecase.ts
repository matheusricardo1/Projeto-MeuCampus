import type { MoodleRepository } from '@/domain/repositories/moodle.repository';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';
import type { MoodleCredentials } from '@/domain/value-objects/moodle-credentials';
import type { Course } from '@/domain/entities/course';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';
import { moodleIdentity } from '@/application/services/moodle-identity';

export class GetCoursesUseCase {
    constructor(
        private readonly repository: MoodleRepository,
        private readonly sessions: MoodleSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: MoodleCredentials): Promise<Course[]> {
        const identity = moodleIdentity(credentials);
        await this.sessions.assertActive(identity);
        return this.cacheAndPublish.run('courses', identity, this.repository.getCourses(credentials));
    }
}

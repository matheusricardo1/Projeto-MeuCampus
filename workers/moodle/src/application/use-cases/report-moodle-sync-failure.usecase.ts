import type { MoodleCacheStore } from '@/application/ports/moodle-cache-store';
import type { MoodleScrapeEventPublisher } from '@/application/ports/moodle-scrape-event-publisher';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';
import type { MoodleSyncJobData } from '@/application/ports/moodle-scrape-job';
import type { MoodleCachedResource } from '@/domain/value-objects/moodle-cached-resource';
import { moodleIdentity } from '@/application/services/moodle-identity';

const CACHEABLE_RESOURCES: readonly string[] = ['courses', 'timeline'];
const JOB_NAME_TO_RESOURCE: Record<string, MoodleCachedResource> = {
    courses: 'courses',
    timeline: 'timeline'
};

export class ReportMoodleSyncFailureUseCase {
    constructor(
        private readonly cache: MoodleCacheStore,
        private readonly sessions: MoodleSessionStore,
        private readonly events: MoodleScrapeEventPublisher
    ) {}

    async execute(name: string, data: MoodleSyncJobData, error: Error): Promise<boolean> {
        const resource = this.toCachedResource(name);
        if (!resource || !('credentials' in data)) {
            return false;
        }

        const identity = moodleIdentity(data.credentials);
        const event = {
            identity,
            resource,
            status: 'failed',
            errorName: error.name,
            message: error.message
        } as const;

        if (error.name === 'AuthenticationError') {
            await Promise.all([
                this.cache.clearUserCache(identity),
                this.sessions.markInvalid(identity, 'authentication-failure')
            ]);
        }

        await this.events.publishFailed(event);
        return true;
    }

    private toCachedResource(name: string): MoodleCachedResource | null {
        return CACHEABLE_RESOURCES.includes(name) ? JOB_NAME_TO_RESOURCE[name] ?? null : null;
    }
}

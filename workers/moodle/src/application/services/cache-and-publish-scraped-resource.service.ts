import type { MoodleCacheStore } from '@/application/ports/moodle-cache-store';
import type { MoodleScrapeEventPublisher } from '@/application/ports/moodle-scrape-event-publisher';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';
import type { MoodleCachedResource } from '@/domain/value-objects/moodle-cached-resource';

/**
 * Shared tail end of every "fetch one Moodle resource" use case: re-check
 * the session (it may have been invalidated while the external fetch was in
 * flight), cache the result, and publish the ready event.
 */
export class CacheAndPublishScrapedResource {
    constructor(
        private readonly sessions: MoodleSessionStore,
        private readonly cache: MoodleCacheStore,
        private readonly events: MoodleScrapeEventPublisher
    ) {}

    async run<T>(resource: MoodleCachedResource, identity: string, resultPromise: Promise<T>, extra?: string): Promise<T> {
        const result = await resultPromise;
        await this.sessions.assertActive(identity);
        await this.cache.save(resource, identity, result, extra);
        await this.events.publishReady({ identity, resource, ...(extra ? { extra } : {}) });
        return result;
    }
}

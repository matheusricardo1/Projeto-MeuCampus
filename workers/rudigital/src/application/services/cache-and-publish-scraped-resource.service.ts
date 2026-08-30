import type { RuDigitalCacheStore } from '@/application/ports/ru-digital-cache-store';
import type { RuDigitalScrapeEventPublisher } from '@/application/ports/ru-digital-scrape-event-publisher';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalCachedResource } from '@/domain/value-objects/ru-digital-cached-resource';

/**
 * Shared tail end of every "fetch one RU Digital resource" use case:
 * re-check the session (it may have been invalidated while the external
 * fetch was in flight), cache the result, and publish the ready event.
 */
export class CacheAndPublishScrapedResource {
    constructor(
        private readonly sessions: RuDigitalSessionStore,
        private readonly cache: RuDigitalCacheStore,
        private readonly events: RuDigitalScrapeEventPublisher
    ) {}

    async run<T>(resource: RuDigitalCachedResource, cpf: string, resultPromise: Promise<T>, date?: string): Promise<T> {
        const result = await resultPromise;
        await this.sessions.assertActive(cpf);
        await this.cache.save(resource, cpf, result, date);
        await this.events.publishReady({ cpf, resource, ...(date ? { date } : {}) });
        return result;
    }
}

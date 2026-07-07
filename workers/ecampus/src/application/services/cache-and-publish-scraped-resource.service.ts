import type { EcampusCacheStore } from '@/application/ports/ecampus-cache-store';
import type { EcampusScrapeEventPublisher } from '@/application/ports/ecampus-scrape-event-publisher';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusCachedResource } from '@/domain/value-objects/ecampus-cached-resource';
import type { EcampusResourceReadyEvent } from '@/application/ports/ecampus-scrape-events';

type ResourceEventParameters = Pick<EcampusResourceReadyEvent, 'year' | 'period' | 'planId'>;

/**
 * Shared tail end of every "fetch one eCampus resource" use case: re-check the
 * session (it may have been invalidated while the slow external scrape was in
 * flight), cache the result, and publish the ready event.
 */
export class CacheAndPublishScrapedResource {
    constructor(
        private readonly sessions: EcampusSessionStore,
        private readonly cache: EcampusCacheStore,
        private readonly events: EcampusScrapeEventPublisher
    ) {}

    async run<T>(
        resource: EcampusCachedResource,
        cpf: string,
        resultPromise: Promise<T>,
        parameters: ResourceEventParameters = {}
    ): Promise<T> {
        const result = await resultPromise;
        await this.sessions.assertActive(cpf);
        const extra = resource === 'grades'
            ? `${parameters.year}-${parameters.period}`
            : resource === 'lesson-plan'
                ? parameters.planId
                : undefined;

        await this.cache.save(resource, cpf, result, extra);
        if (resource === 'grades' && parameters.year && parameters.period) {
            await this.cache.saveCurrentPeriod(cpf, parameters.year, parameters.period);
        }
        await this.events.publishReady({ cpf, resource, ...parameters });
        return result;
    }
}

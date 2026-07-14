import type { EcampusCacheStore } from '@/application/ports/ecampus-cache-store';
import type { EcampusScrapeEventPublisher } from '@/application/ports/ecampus-scrape-event-publisher';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusCachedResource } from '@/domain/value-objects/ecampus-cached-resource';
import type { EcampusResourceReadyEvent } from '@/application/ports/ecampus-scrape-events';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';

type ResourceEventParameters = Pick<EcampusResourceReadyEvent, 'year' | 'period' | 'planId'>;

// schedule/lesson-plan-subjects aren't cached per year/period like grades are
// - they always reflect whatever eCampus's own session currently has
// selected. eCampus sometimes flips that session-current period on its own
// (a new term opening) before the new period's data is actually published,
// so a scrape right in that window can legitimately come back empty even
// though the student's real (previous-period) data was fine moments ago.
// Overwriting good cached data with that empty result made it look like the
// student had nothing at all until the next successful scrape.
const RESOURCES_WHERE_EMPTY_MEANS_SUSPICIOUS: readonly EcampusCachedResource[] = ['schedule', 'lesson-plan-subjects'];

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

        const resolvedResult = await this.resolveResultToCache(resource, cpf, result, extra);

        if (resolvedResult === result) {
            await this.cache.save(resource, cpf, result, extra);
        }
        if (resource === 'grades' && parameters.year && parameters.period) {
            await this.cache.saveCurrentPeriod(cpf, parameters.year, parameters.period);
        }
        await this.events.publishReady({ cpf, resource, ...parameters });
        return resolvedResult;
    }

    /**
     * Returns `result` unchanged in the normal case. Only for the resources
     * above, when `result` is a suspiciously-empty array AND there's already
     * a non-empty cached value, returns that existing value instead and
     * leaves the cache untouched — so the previous good data keeps serving
     * (and keeps counting down its own TTL) rather than being replaced.
     */
    private async resolveResultToCache<T>(resource: EcampusCachedResource, cpf: string, result: T, extra?: string): Promise<T> {
        if (!RESOURCES_WHERE_EMPTY_MEANS_SUSPICIOUS.includes(resource) || !Array.isArray(result) || result.length > 0) {
            return result;
        }

        const existing = await this.cache.get<T>(resource, cpf, extra);
        if (Array.isArray(existing) && existing.length > 0) {
            logger.warning(`eCampus returned an empty ${resource}, keeping the previously cached (non-empty) result instead of overwriting it.`, { cpf });
            return existing;
        }

        return result;
    }
}

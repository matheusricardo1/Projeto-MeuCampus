import type { EcampusCacheStore } from '@/application/ports/ecampus-cache-store';
import type { EcampusScrapeEventPublisher } from '@/application/ports/ecampus-scrape-event-publisher';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusScrapeJobData } from '@/application/ports/ecampus-scrape-job';
import type { EcampusResourceReadyEvent } from '@/application/ports/ecampus-scrape-events';
import type { EcampusCachedResource } from '@/domain/value-objects/ecampus-cached-resource';
import { resolveGradesPeriod } from '@/application/services/resolve-grades-period';

const CACHEABLE_RESOURCES: readonly string[] = ['profile', 'schedule', 'grades', 'lesson-plan-subjects', 'lesson-plan'];

export class ReportEcampusScrapeFailureUseCase {
    constructor(
        private readonly cache: EcampusCacheStore,
        private readonly sessions: EcampusSessionStore,
        private readonly events: EcampusScrapeEventPublisher
    ) {}

    async execute(name: string, data: EcampusScrapeJobData, error: Error): Promise<boolean> {
        const resource = this.toCachedResource(name);
        if (!resource || !('credentials' in data)) {
            return false;
        }

        const event = {
            cpf: data.credentials.cpf,
            resource,
            status: 'failed',
            errorName: error.name,
            message: error.message,
            ...this.getEventParameters(resource, data)
        } as const;

        if (error.name === 'AuthenticationError') {
            await Promise.all([
                this.cache.clearUserCache(event.cpf),
                this.sessions.markInvalid(event.cpf, 'authentication-failure')
            ]);
        }

        await this.events.publishFailed(event);
        return true;
    }

    private toCachedResource(name: string): EcampusCachedResource | null {
        return CACHEABLE_RESOURCES.includes(name) ? name as EcampusCachedResource : null;
    }

    private getEventParameters(
        resource: EcampusCachedResource,
        data: EcampusScrapeJobData
    ): Pick<EcampusResourceReadyEvent, 'year' | 'period' | 'planId'> {
        if (resource === 'grades') {
            return resolveGradesPeriod(data);
        }

        if (resource === 'lesson-plan' && 'planId' in data) {
            return { planId: data.planId };
        }

        return {};
    }
}

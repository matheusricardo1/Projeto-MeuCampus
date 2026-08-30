import type { RuDigitalCacheStore } from '@/application/ports/ru-digital-cache-store';
import type { RuDigitalScrapeEventPublisher } from '@/application/ports/ru-digital-scrape-event-publisher';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalScrapeJobData } from '@/application/ports/ru-digital-scrape-job';
import type { RuDigitalCachedResource } from '@/domain/value-objects/ru-digital-cached-resource';

const CACHEABLE_RESOURCES: readonly string[] = ['student', 'balance', 'daily-menu', 'default-restaurant', 'last-consumption', 'restaurant-list'];

const JOB_NAME_TO_RESOURCE: Record<string, RuDigitalCachedResource> = {
    student: 'discente',
    balance: 'saldo',
    'daily-menu': 'cardapio',
    'default-restaurant': 'restaurante',
    'last-consumption': 'ultimo-consumo',
    'restaurant-list': 'restaurantes'
};

export class ReportRuDigitalScrapeFailureUseCase {
    constructor(
        private readonly cache: RuDigitalCacheStore,
        private readonly sessions: RuDigitalSessionStore,
        private readonly events: RuDigitalScrapeEventPublisher
    ) {}

    async execute(name: string, data: RuDigitalScrapeJobData, error: Error): Promise<boolean> {
        const resource = this.toCachedResource(name);
        if (!resource || !('credentials' in data)) {
            return false;
        }

        const date = 'date' in data ? data.date : undefined;
        const event = {
            cpf: data.credentials.cpf,
            resource,
            status: 'failed',
            errorName: error.name,
            message: error.message,
            ...(date ? { date } : {})
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

    private toCachedResource(name: string): RuDigitalCachedResource | null {
        return CACHEABLE_RESOURCES.includes(name) ? JOB_NAME_TO_RESOURCE[name] ?? null : null;
    }
}

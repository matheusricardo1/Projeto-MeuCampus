import { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { LastConsumption } from '@ru-digital/domain/entities/last-consumption.entity';
import { pendingScrapeJob, type PendingScrapeJob } from '@ru-digital/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@ru-digital/application/services/scraping-job-dedupe-key';

export class GetLastConsumptionUseCase {
    constructor(
        private readonly cache: RuDigitalDataRepository,
        private readonly scrapingJobService: ScrapingJobService
    ) {}

    async execute(credentials: RuDigitalCredentials, restaurantId: string): Promise<LastConsumption | PendingScrapeJob> {
        try {
            return await this.cache.getLastConsumption(credentials.cpf, restaurantId);
        } catch (error) {
            if (!(error instanceof RuDigitalResourceNotFoundException)) {
                throw error;
            }

            await this.scrapingJobService.enqueue('last-consumption', { credentials, restaurantId }, {
                dedupeKey: scrapingJobDedupeKey(credentials, 'ru-digital-last-consumption', restaurantId)
            });
            return pendingScrapeJob('last-consumption');
        }
    }
}

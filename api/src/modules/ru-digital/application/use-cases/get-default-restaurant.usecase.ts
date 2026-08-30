import { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { Restaurant } from '@ru-digital/domain/entities/restaurant.entity';
import { pendingScrapeJob, type PendingScrapeJob } from '@ru-digital/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@ru-digital/application/services/scraping-job-dedupe-key';

export class GetDefaultRestaurantUseCase {
    constructor(
        private readonly cache: RuDigitalDataRepository,
        private readonly scrapingJobService: ScrapingJobService
    ) {}

    async execute(credentials: RuDigitalCredentials): Promise<Restaurant | PendingScrapeJob> {
        try {
            return await this.cache.getDefaultRestaurant(credentials.cpf);
        } catch (error) {
            if (!(error instanceof RuDigitalResourceNotFoundException)) {
                throw error;
            }

            await this.scrapingJobService.enqueue('default-restaurant', { credentials }, {
                dedupeKey: scrapingJobDedupeKey(credentials, 'ru-digital-default-restaurant')
            });
            return pendingScrapeJob('default-restaurant');
        }
    }
}

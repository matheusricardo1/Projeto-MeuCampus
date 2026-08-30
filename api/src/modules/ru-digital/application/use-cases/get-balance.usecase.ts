import { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { Balance } from '@ru-digital/domain/entities/balance.entity';
import { pendingScrapeJob, type PendingScrapeJob } from '@ru-digital/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@ru-digital/application/services/scraping-job-dedupe-key';

export class GetBalanceUseCase {
    constructor(
        private readonly cache: RuDigitalDataRepository,
        private readonly scrapingJobService: ScrapingJobService
    ) {}

    async execute(credentials: RuDigitalCredentials): Promise<Balance | PendingScrapeJob> {
        try {
            return await this.cache.getBalance(credentials.cpf);
        } catch (error) {
            if (!(error instanceof RuDigitalResourceNotFoundException)) {
                throw error;
            }

            await this.scrapingJobService.enqueue('balance', { credentials }, {
                dedupeKey: scrapingJobDedupeKey(credentials, 'ru-digital-balance')
            });
            return pendingScrapeJob('balance');
        }
    }
}

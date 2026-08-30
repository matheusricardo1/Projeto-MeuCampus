import { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { DailyMenu } from '@ru-digital/domain/entities/daily-menu.entity';
import { pendingScrapeJob, type PendingScrapeJob } from '@ru-digital/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@ru-digital/application/services/scraping-job-dedupe-key';

export class GetDailyMenuUseCase {
    constructor(
        private readonly cache: RuDigitalDataRepository,
        private readonly scrapingJobService: ScrapingJobService
    ) {}

    async execute(credentials: RuDigitalCredentials, date: string): Promise<DailyMenu | PendingScrapeJob> {
        try {
            return await this.cache.getDailyMenu(credentials.cpf, date);
        } catch (error) {
            if (!(error instanceof RuDigitalResourceNotFoundException)) {
                throw error;
            }

            await this.scrapingJobService.enqueue('daily-menu', { credentials, date }, {
                dedupeKey: scrapingJobDedupeKey(credentials, 'ru-digital-daily-menu', date)
            });
            return pendingScrapeJob('daily-menu');
        }
    }
}

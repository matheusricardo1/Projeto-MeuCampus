import { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { Student } from '@ru-digital/domain/entities/student.entity';
import { pendingScrapeJob, type PendingScrapeJob } from '@ru-digital/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@ru-digital/application/services/scraping-job-dedupe-key';

export class GetStudentUseCase {
    constructor(
        private readonly cache: RuDigitalDataRepository,
        private readonly scrapingJobService: ScrapingJobService
    ) {}

    async execute(credentials: RuDigitalCredentials): Promise<Student | PendingScrapeJob> {
        try {
            return await this.cache.getStudent(credentials.cpf);
        } catch (error) {
            if (!(error instanceof RuDigitalResourceNotFoundException)) {
                throw error;
            }

            await this.scrapingJobService.enqueue('student', { credentials }, {
                dedupeKey: scrapingJobDedupeKey(credentials, 'ru-digital-student')
            });
            return pendingScrapeJob('student');
        }
    }
}

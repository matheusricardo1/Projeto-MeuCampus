import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { ScheduleClass } from '@academic/domain/value-objects/schedule-class.value-object';
import { pendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import type { PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';

export class GetScheduleUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(credentials: AcademicCredentials): Promise<ScheduleClass[] | PendingScrapeJob> {
    try {
      return await this.cache.getSchedule(credentials.cpf);
    } catch (error) {
      if (!(error instanceof AcademicResourceNotFoundException)) {
        throw error;
      }

      await this.scrapingJobService.enqueue('schedule', { credentials }, {
        dedupeKey: scrapingJobDedupeKey(credentials, 'schedule'),
      });
      return pendingScrapeJob('schedule');
    }
  }
}

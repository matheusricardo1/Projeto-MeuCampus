import { Injectable, NotFoundException } from '@nestjs/common';
import { AcademicDataRepository } from '@/modules/academic/application/ports/academic-data-repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { AcademicCredentials } from '@academic/domain/models/academic-credentials';
import type { ScheduleClass } from '@academic/domain/models/schedule-class';
import { pendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import type { PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';

@Injectable()
export class GetScheduleUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(credentials: AcademicCredentials): Promise<ScheduleClass[] | PendingScrapeJob> {
    try {
      return await this.cache.getSchedule(credentials.cpf);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      const job = await this.scrapingJobService.enqueue('schedule', { credentials });
      return pendingScrapeJob('schedule');
    }
  }
}

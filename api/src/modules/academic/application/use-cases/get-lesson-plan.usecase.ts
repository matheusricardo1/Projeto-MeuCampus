import { Injectable, NotFoundException } from '@nestjs/common';
import { AcademicDataRepository } from '@/modules/academic/application/ports/academic-data-repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { AcademicCredentials } from '@academic/domain/models/academic-credentials';
import type { LessonPlanItem } from '@academic/domain/models/lesson-plan-item';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';

@Injectable()
export class GetLessonPlanUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(credentials: AcademicCredentials, planId: string): Promise<LessonPlanItem[] | PendingScrapeJob> {
    try {
      return await this.cache.getLessonPlan(credentials.cpf, planId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      const job = await this.scrapingJobService.enqueue('lesson-plan', { credentials, planId });
      return pendingScrapeJob('lesson-plan');
    }
  }
}

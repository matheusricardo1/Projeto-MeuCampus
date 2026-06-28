import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { LessonPlanItem } from '@academic/domain/value-objects/lesson-plan-item.value-object';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';

export class GetLessonPlanUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(credentials: AcademicCredentials, planId: string): Promise<LessonPlanItem[] | PendingScrapeJob> {
    try {
      return await this.cache.getLessonPlan(credentials.cpf, planId);
    } catch (error) {
      if (!(error instanceof AcademicResourceNotFoundException)) {
        throw error;
      }

      await this.scrapingJobService.enqueue('lesson-plan', { credentials, planId }, {
        dedupeKey: scrapingJobDedupeKey(credentials, 'lesson-plan', planId),
      });
      return pendingScrapeJob('lesson-plan');
    }
  }
}

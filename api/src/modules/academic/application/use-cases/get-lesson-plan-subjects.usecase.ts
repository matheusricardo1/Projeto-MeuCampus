import { Injectable, NotFoundException } from '@nestjs/common';
import { AcademicDataRepository } from '@/modules/academic/application/ports/academic-data-repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import type { AcademicCredentials } from '@academic/domain/models/academic-credentials';
import type { LessonPlanSubject } from '@academic/domain/models/lesson-plan-subject';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';

@Injectable()
export class GetLessonPlanSubjectsUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(credentials: AcademicCredentials): Promise<LessonPlanSubject[] | PendingScrapeJob> {
    try {
      return await this.cache.getLessonPlanSubjects(credentials.cpf);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      const job = await this.scrapingJobService.enqueue('lesson-plan-subjects', { credentials });
      return pendingScrapeJob('lesson-plan-subjects');
    }
  }
}

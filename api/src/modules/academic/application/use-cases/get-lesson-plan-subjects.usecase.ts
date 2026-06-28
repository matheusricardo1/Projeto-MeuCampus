import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { LessonPlanSubject } from '@academic/domain/entities/lesson-plan-subject.entity';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';

export class GetLessonPlanSubjectsUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(credentials: AcademicCredentials): Promise<LessonPlanSubject[] | PendingScrapeJob> {
    try {
      return await this.cache.getLessonPlanSubjects(credentials.cpf);
    } catch (error) {
      if (!(error instanceof AcademicResourceNotFoundException)) {
        throw error;
      }

      await this.scrapingJobService.enqueue('lesson-plan-subjects', { credentials }, {
        dedupeKey: scrapingJobDedupeKey(credentials, 'lesson-plan-subjects'),
      });
      return pendingScrapeJob('lesson-plan-subjects');
    }
  }
}

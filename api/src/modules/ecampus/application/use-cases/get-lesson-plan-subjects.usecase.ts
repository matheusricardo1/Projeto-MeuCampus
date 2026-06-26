import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { LessonPlanSubject } from '@ecampus/domain/models/lesson-plan-subject';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/ecampus/application/services/pending-scrape-job';

@Injectable()
export class GetLessonPlanSubjectsUseCase {
  constructor(
    private readonly cache: CacheRepository,
    private readonly jobService: JobService,
  ) {}

  async execute(credentials: EcampusCredentials): Promise<LessonPlanSubject[] | PendingScrapeJob> {
    try {
      return await this.cache.getLessonPlanSubjects(credentials.cpf);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      const job = await this.jobService.enqueue('lesson-plan-subjects', { credentials });
      return pendingScrapeJob('lesson-plan-subjects');
    }
  }
}

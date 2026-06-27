import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import type { AcademicSubject } from '@ecampus/domain/models/academic-subject';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/ecampus/application/services/pending-scrape-job';

export interface AcademicSubjectsInput {
  credentials: EcampusCredentials;
  year: string;
  period: string;
}

@Injectable()
export class GetAcademicSubjectsUseCase {
  constructor(
    private readonly cache: CacheRepository,
    private readonly jobService: JobService,
  ) {}

  async execute(input: AcademicSubjectsInput): Promise<AcademicSubject[] | PendingScrapeJob> {
    try {
      return await this.cache.getAcademicSubjects(input.credentials.cpf, input.year, input.period);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      await Promise.all([
        this.jobService.enqueue('grades', {
          credentials: input.credentials,
          year: input.year,
          period: input.period,
        }),
        this.jobService.enqueue('schedule', { credentials: input.credentials }),
        this.jobService.enqueue('lesson-plan-subjects', { credentials: input.credentials }),
      ]);

      return pendingScrapeJob('grades');
    }
  }
}

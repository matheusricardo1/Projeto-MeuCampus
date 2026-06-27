import { Injectable, NotFoundException } from '@nestjs/common';
import { AcademicDataRepository } from '@/modules/academic/application/ports/academic-data-repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import type { AcademicSubject } from '@academic/domain/models/academic-subject';
import type { AcademicCredentials } from '@academic/domain/models/academic-credentials';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';

export interface AcademicSubjectsInput {
  credentials: AcademicCredentials;
  year: string;
  period: string;
}

@Injectable()
export class GetAcademicSubjectsUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(input: AcademicSubjectsInput): Promise<AcademicSubject[] | PendingScrapeJob> {
    try {
      return await this.cache.getAcademicSubjects(input.credentials.cpf, input.year, input.period);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      await Promise.all([
        this.scrapingJobService.enqueue('grades', {
          credentials: input.credentials,
          year: input.year,
          period: input.period,
        }),
        this.scrapingJobService.enqueue('schedule', { credentials: input.credentials }),
        this.scrapingJobService.enqueue('lesson-plan-subjects', { credentials: input.credentials }),
      ]);

      return pendingScrapeJob('grades');
    }
  }
}

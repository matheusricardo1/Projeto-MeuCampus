import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import type { AcademicSubject } from '@academic/domain/entities/academic-subject.entity';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';
import { resolveCurrentGradesPeriod } from '@academic/application/services/resolve-current-grades-period';

export interface AcademicSubjectsInput {
  credentials: AcademicCredentials;
  year?: string | undefined;
  period?: string | undefined;
}

export class GetAcademicSubjectsUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(input: AcademicSubjectsInput): Promise<AcademicSubject[] | PendingScrapeJob> {
    const { year, period, needsScrape } = input.year && input.period
      ? { year: input.year, period: input.period, needsScrape: false }
      : await resolveCurrentGradesPeriod(this.cache, input.credentials.cpf);

    if (needsScrape) {
      await this.enqueueMissingResource('grades', { credentials: input.credentials, year, period });
      return pendingScrapeJob('grades');
    }

    try {
      return await this.cache.getAcademicSubjects(input.credentials.cpf, year, period);
    } catch (error) {
      if (!(error instanceof AcademicResourceNotFoundException)) {
        throw error;
      }

      await this.enqueueMissingResource(error.resource, { credentials: input.credentials, year, period });
      return pendingScrapeJob(error.resource);
    }
  }

  private async enqueueMissingResource(
    resource: AcademicResourceNotFoundException['resource'],
    input: { credentials: AcademicCredentials; year: string; period: string }
  ): Promise<void> {
    if (resource === 'grades') {
      await this.scrapingJobService.enqueue('grades', {
        credentials: input.credentials,
        year: input.year,
        period: input.period,
      }, {
        dedupeKey: scrapingJobDedupeKey(input.credentials, 'grades', `${input.year}-${input.period}`),
      });
      return;
    }

    if (resource === 'schedule' || resource === 'lesson-plan-subjects') {
      await this.scrapingJobService.enqueue(resource, { credentials: input.credentials }, {
        dedupeKey: scrapingJobDedupeKey(input.credentials, resource),
      });
    }
  }
}

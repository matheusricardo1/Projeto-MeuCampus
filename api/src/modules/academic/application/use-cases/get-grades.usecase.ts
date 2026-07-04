import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { Grade } from '@academic/domain/entities/grade.entity';
import { pendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import type { PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';
import { resolveCurrentGradesPeriod } from '@academic/application/services/resolve-current-grades-period';

export interface GradesInput {
  credentials: AcademicCredentials;
  year?: string | undefined;
  period?: string | undefined;
}

export class GetGradesUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(input: GradesInput): Promise<Grade[] | PendingScrapeJob> {
    const { year, period, needsScrape } = input.year && input.period
      ? { year: input.year, period: input.period, needsScrape: false }
      : await resolveCurrentGradesPeriod(this.cache, input.credentials.cpf);

    if (needsScrape) {
      return this.enqueueGradesScrape(input.credentials, year, period);
    }

    try {
      return await this.cache.getGrades(input.credentials.cpf, year, period);
    } catch (error) {
      if (!(error instanceof AcademicResourceNotFoundException)) {
        throw error;
      }

      return this.enqueueGradesScrape(input.credentials, year, period);
    }
  }

  private async enqueueGradesScrape(credentials: AcademicCredentials, year: string, period: string): Promise<PendingScrapeJob> {
    await this.scrapingJobService.enqueue('grades', {
      credentials,
      year,
      period,
    }, {
      dedupeKey: scrapingJobDedupeKey(credentials, 'grades', `${year}-${period}`),
    });

    return pendingScrapeJob('grades');
  }
}

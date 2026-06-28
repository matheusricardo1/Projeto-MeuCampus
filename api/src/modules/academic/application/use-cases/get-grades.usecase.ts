import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { Grade } from '@academic/domain/entities/grade.entity';
import { pendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import type { PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';

export interface GradesInput {
  credentials: AcademicCredentials;
  year: string;
  period: string;
}

export class GetGradesUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(input: GradesInput): Promise<Grade[] | PendingScrapeJob> {
    try {
      return await this.cache.getGrades(input.credentials.cpf, input.year, input.period);
    } catch (error) {
      if (!(error instanceof AcademicResourceNotFoundException)) {
        throw error;
      }

      await this.scrapingJobService.enqueue('grades', {
        credentials: input.credentials,
        year: input.year,
        period: input.period,
      }, {
        dedupeKey: scrapingJobDedupeKey(input.credentials, 'grades', `${input.year}-${input.period}`),
      });

      return pendingScrapeJob('grades');
    }
  }
}

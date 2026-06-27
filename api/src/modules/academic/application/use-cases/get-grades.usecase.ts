import { Injectable, NotFoundException } from '@nestjs/common';
import { AcademicDataRepository } from '@/modules/academic/application/ports/academic-data-repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { AcademicCredentials } from '@academic/domain/models/academic-credentials';
import type { Grade } from '@academic/domain/models/grade';
import { pendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import type { PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';

export interface GradesInput {
  credentials: AcademicCredentials;
  year: string;
  period: string;
}

@Injectable()
export class GetGradesUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(input: GradesInput): Promise<Grade[] | PendingScrapeJob> {
    try {
      return await this.cache.getGrades(input.credentials.cpf, input.year, input.period);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      const job = await this.scrapingJobService.enqueue('grades', {
        credentials: input.credentials,
        year: input.year,
        period: input.period,
      });

      return pendingScrapeJob('grades');
    }
  }
}

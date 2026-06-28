import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import type { AcademicSubject } from '@academic/domain/entities/academic-subject.entity';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';

export interface AcademicSubjectsInput {
  credentials: AcademicCredentials;
  year: string;
  period: string;
}

export class GetAcademicSubjectsUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(input: AcademicSubjectsInput): Promise<AcademicSubject[] | PendingScrapeJob> {
    try {
      return await this.cache.getAcademicSubjects(input.credentials.cpf, input.year, input.period);
    } catch (error) {
      if (!(error instanceof AcademicResourceNotFoundException)) {
        throw error;
      }

      await this.enqueueMissingResource(error.resource, input);
      return pendingScrapeJob(error.resource);
    }
  }

  private async enqueueMissingResource(resource: AcademicResourceNotFoundException['resource'], input: AcademicSubjectsInput): Promise<void> {
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

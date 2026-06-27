import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { Grade } from '@ecampus/domain/models/grade';
import { pendingScrapeJob } from '@/modules/ecampus/application/services/pending-scrape-job';
import type { PendingScrapeJob } from '@/modules/ecampus/application/services/pending-scrape-job';

export interface GradesInput {
  credentials: EcampusCredentials;
  year: string;
  period: string;
}

@Injectable()
export class GetGradesUseCase {
  constructor(
    private readonly cache: CacheRepository,
    private readonly jobService: JobService,
  ) {}

  async execute(input: GradesInput): Promise<Grade[] | PendingScrapeJob> {
    try {
      return await this.cache.getGrades(input.credentials.cpf, input.year, input.period);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      const job = await this.jobService.enqueue('grades', {
        credentials: input.credentials,
        year: input.year,
        period: input.period,
      });

      return pendingScrapeJob('grades');
    }
  }
}

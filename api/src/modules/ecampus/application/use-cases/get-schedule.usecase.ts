import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { ScheduleClass } from '@ecampus/domain/models/schedule-class';
import { pendingScrapeJob } from '@/modules/ecampus/application/services/pending-scrape-job';
import type { PendingScrapeJob } from '@/modules/ecampus/application/services/pending-scrape-job';

@Injectable()
export class GetScheduleUseCase {
  constructor(
    private readonly cache: CacheRepository,
    private readonly jobService: JobService,
  ) {}

  async execute(credentials: EcampusCredentials): Promise<ScheduleClass[] | PendingScrapeJob> {
    try {
      return await this.cache.getSchedule(credentials.cpf);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      const job = await this.jobService.enqueue('schedule', { credentials });
      return pendingScrapeJob('schedule');
    }
  }
}

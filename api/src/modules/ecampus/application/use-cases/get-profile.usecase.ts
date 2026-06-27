import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { StudentProfile } from '@ecampus/domain/models/student-profile';
import { pendingScrapeJob } from '@/modules/ecampus/application/services/pending-scrape-job';
import type { PendingScrapeJob } from '@/modules/ecampus/application/services/pending-scrape-job';

@Injectable()
export class GetProfileUseCase {
  constructor(
    private readonly cache: CacheRepository,
    private readonly jobService: JobService,
  ) {}

  async execute(credentials: EcampusCredentials): Promise<StudentProfile | PendingScrapeJob> {
    try {
      return await this.cache.getProfile(credentials.cpf);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      const job = await this.jobService.enqueue('profile', { credentials });
      return pendingScrapeJob('profile');
    }
  }
}

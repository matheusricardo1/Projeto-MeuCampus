import { Injectable, BadRequestException } from '@nestjs/common';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';

@Injectable()
export class GetScheduleUseCase {
  constructor(
    private readonly cache: CacheRepository,
    private readonly jobService: JobService,
  ) {}

  async execute(credentials: EcampusCredentials): Promise<any> {
    try {
      return await this.cache.getSchedule(credentials.cpf);
    } catch {
      const job = await this.jobService.enqueue('schedule', { credentials });
      throw new BadRequestException({ message: 'Schedule not cached yet', jobId: job.id });
    }
  }
}

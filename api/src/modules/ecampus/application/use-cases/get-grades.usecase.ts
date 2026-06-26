import { Injectable, BadRequestException } from '@nestjs/common';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';

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

  async execute(input: GradesInput): Promise<any> {
    try {
      return await this.cache.getGrades(input.credentials.cpf);
    } catch {
      const job = await this.jobService.enqueue('grades', {
        credentials: input.credentials,
        year: input.year,
        period: input.period,
      });
      throw new BadRequestException({ message: 'Grades not cached yet', jobId: job.id });
    }
  }
}

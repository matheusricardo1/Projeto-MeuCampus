import { Injectable, BadRequestException } from '@nestjs/common';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { LessonPlanItem } from '@ecampus/domain/models/lesson-plan-item';

@Injectable()
export class GetLessonPlanUseCase {
  constructor(
    private readonly cache: CacheRepository,
    private readonly jobService: JobService,
  ) {}

  async execute(credentials: EcampusCredentials, planId: string): Promise<LessonPlanItem[]> {
    const job = await this.jobService.enqueue('lesson-plan', { credentials, planId });
    throw new BadRequestException({ message: 'Lesson plan not cached yet', jobId: job.id });
  }
}

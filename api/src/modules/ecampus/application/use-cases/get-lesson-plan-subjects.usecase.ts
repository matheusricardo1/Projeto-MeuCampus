import { Injectable, BadRequestException } from '@nestjs/common';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { LessonPlanSubject } from '@ecampus/domain/models/lesson-plan-subject';

@Injectable()
export class GetLessonPlanSubjectsUseCase {
  constructor(
    private readonly cache: CacheRepository,
    private readonly jobService: JobService,
  ) {}

  async execute(credentials: EcampusCredentials): Promise<LessonPlanSubject[]> {
    try {
      return await this.cache.getLessonPlanSubjects(credentials.cpf);
    } catch {
      const job = await this.jobService.enqueue('lesson-plan-subjects', { credentials });
      throw new BadRequestException({ message: 'Lesson plan subjects not cached yet', jobId: job.id });
    }
  }
}

import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { AcademicBootstrapTracker } from '@academic/application/ports/academic-bootstrap-tracker';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';
import { getCurrentAcademicPeriod } from '@academic/application/services/current-academic-period';
import type { AcademicResource } from '@academic/domain/value-objects/academic-resource.value-object';

const BOOTSTRAP_RESOURCES: AcademicResource[] = ['profile', 'schedule', 'grades', 'lesson-plan-subjects'];

export class PrefetchAcademicDataUseCase {
  constructor(
    private readonly scrapingJobService: ScrapingJobService,
    private readonly bootstrapTracker: AcademicBootstrapTracker,
  ) {}

  async execute(credentials: AcademicCredentials, now = new Date()): Promise<void> {
    const period = getCurrentAcademicPeriod(now);
    await this.bootstrapTracker.start(credentials.cpf, BOOTSTRAP_RESOURCES);

    await Promise.all([
      this.scrapingJobService.enqueue('profile', { credentials }, {
        dedupeKey: scrapingJobDedupeKey(credentials, 'profile'),
      }),
      this.scrapingJobService.enqueue('schedule', { credentials }, {
        dedupeKey: scrapingJobDedupeKey(credentials, 'schedule'),
      }),
      this.scrapingJobService.enqueue('grades', { credentials, ...period }, {
        dedupeKey: scrapingJobDedupeKey(credentials, 'grades', `${period.year}-${period.period}`),
      }),
      this.scrapingJobService.enqueue('lesson-plan-subjects', { credentials }, {
        dedupeKey: scrapingJobDedupeKey(credentials, 'lesson-plan-subjects'),
      }),
    ]);
  }
}

import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';
import { getCurrentAcademicPeriod } from '@academic/application/services/current-academic-period';

export class PrefetchAcademicDataUseCase {
  constructor(private readonly scrapingJobService: ScrapingJobService) {}

  async execute(credentials: AcademicCredentials, now = new Date()): Promise<void> {
    const period = getCurrentAcademicPeriod(now);

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

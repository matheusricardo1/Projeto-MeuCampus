import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { StudentProfile } from '@academic/domain/entities/student-profile.entity';
import { pendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import type { PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';

export class GetProfileUseCase {
  constructor(
    private readonly cache: AcademicDataRepository,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(credentials: AcademicCredentials): Promise<StudentProfile | PendingScrapeJob> {
    try {
      return await this.cache.getProfile(credentials.cpf);
    } catch (error) {
      if (!(error instanceof AcademicResourceNotFoundException)) {
        throw error;
      }

      await this.scrapingJobService.enqueue('profile', { credentials }, {
        dedupeKey: scrapingJobDedupeKey(credentials, 'profile'),
      });
      return pendingScrapeJob('profile');
    }
  }
}

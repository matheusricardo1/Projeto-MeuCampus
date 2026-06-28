import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { appLogger } from '@/shared/logging/app-logger';

export class LogoutAcademicSessionUseCase {
    constructor(
        private readonly scrapingJobService: ScrapingJobService,
        private readonly academicDataRepository: AcademicDataRepository,
        private readonly sessionRegistry: AcademicSessionRegistry
    ) {}

    async execute(credentials: AcademicCredentials): Promise<void> {
        const job = await this.scrapingJobService.enqueue('logout', { credentials });

        try {
            await job.waitUntilFinished(10000);
        } catch (error) {
            appLogger.warning('Logout worker job failed or timed out; clearing academic cache from API.', {
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
        }

        const cacheDeletedKeys = await this.academicDataRepository.clearUserCache(credentials.cpf);
        await this.sessionRegistry.invalidate(credentials.cpf);
        appLogger.info('Cleared academic cached data from API after logout.', {
            cacheDeletedKeys
        });
    }
}

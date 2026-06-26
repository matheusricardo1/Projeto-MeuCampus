import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import { appLogger } from '@/shared/logging/app-logger';

export class LogoutEcampusUseCase {
    constructor(
        private readonly jobService: JobService,
        private readonly cacheRepository: CacheRepository
    ) {}

    async execute(credentials: EcampusCredentials): Promise<void> {
        const job = await this.jobService.enqueue('logout', { credentials });

        try {
            await job.waitUntilFinished(this.jobService.getQueueEvents(), 10000);
        } catch (error) {
            appLogger.warning('Logout worker job failed or timed out; clearing eCampus cache from API.', {
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
        }

        const cacheDeletedKeys = await this.cacheRepository.clearUserCache(credentials.cpf);
        appLogger.info('Cleared eCampus cached data from API after logout.', {
            cacheDeletedKeys
        });
    }
}

import { Worker, type Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { MoodleAuthService } from '@/infrastructure/moodle-portal/moodle-auth-service';
import { MoodleHttpRepository } from '@/infrastructure/moodle-portal/moodle-http.repository';
import { appLogger } from '@/infrastructure/logging/app-logger';
import { createRedisConnectionOptions } from '@/infrastructure/redis/redis-connection';
import {
    MOODLE_SYNC_QUEUE_NAME,
    type MoodleSyncJobData,
    type MoodleSyncJobName,
    type EncryptedMoodleSyncJobData
} from '@/application/ports/moodle-scrape-job';
import { RedisMoodleSessionCoordinator } from '@/infrastructure/redis/redis-moodle-session-coordinator';
import { RedisMoodleCacheStore } from '@/infrastructure/redis/redis-moodle-cache.store';
import { RedisMoodleScrapeEventPublisher } from '@/infrastructure/redis/redis-moodle-scrape-event.publisher';
import { ProcessMoodleSyncJobUseCase } from '@/application/use-cases/process-moodle-sync-job.usecase';
import { LoginMoodleSessionUseCase } from '@/application/use-cases/login-moodle-session.usecase';
import { LogoutMoodleSessionUseCase } from '@/application/use-cases/logout-moodle-session.usecase';
import { GetCoursesUseCase } from '@/application/use-cases/get-courses.usecase';
import { GetTimelineUseCase } from '@/application/use-cases/get-timeline.usecase';
import { ReportMoodleSyncFailureUseCase } from '@/application/use-cases/report-moodle-sync-failure.usecase';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';
import { decryptQueuePayload } from '@/infrastructure/crypto/moodle-queue-payload-cipher';

export class MoodleSyncWorker {
    private readonly redis = new Redis(createRedisConnectionOptions());
    private readonly publishedFailedJobIds = new Set<string>();
    private readonly processJob: ProcessMoodleSyncJobUseCase;
    private readonly worker: Worker<EncryptedMoodleSyncJobData>;

    constructor() {
        // Zero 'error' listeners on an ioredis client throws synchronously on
        // any connection blip and crashes the process — see workers/ecampus
        // for the same fix. ioredis reconnects on its own; this only stops
        // the crash and leaves a trail.
        this.redis.on('error', (error) => {
            appLogger.warning('Moodle worker Redis client reported a connection error.', {
                errorName: error.name,
                message: error.message
            });
        });

        const authService = new MoodleAuthService();
        const repository = new MoodleHttpRepository(authService);
        const sessions = new RedisMoodleSessionCoordinator(this.redis);
        const cache = new RedisMoodleCacheStore(this.redis);
        const events = new RedisMoodleScrapeEventPublisher(this.redis);
        const cacheAndPublish = new CacheAndPublishScrapedResource(sessions, cache, events);

        this.processJob = new ProcessMoodleSyncJobUseCase(
            new LoginMoodleSessionUseCase(authService, sessions, events),
            new LogoutMoodleSessionUseCase(repository, cache, sessions),
            new GetCoursesUseCase(repository, sessions, cacheAndPublish),
            new GetTimelineUseCase(repository, sessions, cacheAndPublish),
            new ReportMoodleSyncFailureUseCase(cache, sessions, events)
        );

        this.worker = new Worker<EncryptedMoodleSyncJobData>(
            MOODLE_SYNC_QUEUE_NAME,
            (job) => this.process(job),
            {
                connection: createRedisConnectionOptions() as ConnectionOptions,
                concurrency: Number(process.env.MOODLE_SYNC_WORKER_CONCURRENCY || 10)
            }
        );

        this.worker.on('completed', (job) => {
            appLogger.info('Moodle sync job completed.', { jobId: job.id, jobName: job.name });
        });

        this.worker.on('failed', (job, error) => {
            appLogger.error('Moodle sync job failed.', {
                jobId: job?.id,
                jobName: job?.name,
                errorName: error.name,
                message: error.message
            });

            if (job && this.isTerminalFailure(job)) {
                void this.publishFailedJob(job, error, 'worker-failed-listener');
                return;
            }

            if (job) {
                appLogger.warning('Transient Moodle sync failure. Waiting for retry before notifying API.', {
                    jobId: job.id,
                    jobName: job.name,
                    attemptsMade: job.attemptsMade,
                    attempts: this.getConfiguredAttempts(job)
                });
            }
        });
    }

    async run(): Promise<void> {
        appLogger.info('Moodle sync worker started.', {
            queue: MOODLE_SYNC_QUEUE_NAME,
            concurrency: Number(process.env.MOODLE_SYNC_WORKER_CONCURRENCY || 10)
        });
    }

    async close(): Promise<void> {
        await this.worker.close();
        await this.redis.quit();
    }

    private async process(job: Job<EncryptedMoodleSyncJobData>): Promise<unknown> {
        const name = job.name as MoodleSyncJobName;

        appLogger.info('Processing Moodle sync job.', {
            jobId: job.id,
            jobName: name
        });

        try {
            return await this.processJob.execute(name, this.decryptJobData(job), job.id);
        } catch (error) {
            throw this.toError(error);
        }
    }

    private isTerminalFailure(job: Job<EncryptedMoodleSyncJobData>): boolean {
        return job.attemptsMade >= this.getConfiguredAttempts(job);
    }

    private getConfiguredAttempts(job: Job<EncryptedMoodleSyncJobData>): number {
        const attempts = Number(job.opts.attempts ?? 1);
        return Number.isFinite(attempts) && attempts > 0 ? attempts : 1;
    }

    private decryptJobData(job: Job<EncryptedMoodleSyncJobData>): MoodleSyncJobData {
        return decryptQueuePayload<MoodleSyncJobData>(job.data.__enc);
    }

    private async publishFailedJob(job: Job<EncryptedMoodleSyncJobData>, error: Error, origin: 'processor-catch' | 'worker-failed-listener'): Promise<void> {
        const jobId = job.id ?? `${job.name}:${job.timestamp}`;
        if (this.publishedFailedJobIds.has(jobId)) {
            return;
        }

        try {
            this.publishedFailedJobIds.add(jobId);
            const published = await this.processJob.handleFailure(job.name, this.decryptJobData(job), error);
            if (!published) {
                appLogger.warning('Skipped Moodle sync failure notification without publishable job data.', {
                    jobId: job.id,
                    jobName: job.name,
                    origin,
                    errorName: error.name
                });
                return;
            }

            appLogger.warning('Published Moodle sync failure notification.', {
                jobId: job.id,
                jobName: job.name,
                errorName: error.name,
                origin
            });
        } catch (publishError) {
            this.publishedFailedJobIds.delete(jobId);
            appLogger.error('Failed to publish Moodle sync failure notification.', {
                jobId: job.id,
                jobName: job.name,
                errorName: error.name,
                origin,
                publishErrorName: publishError instanceof Error ? publishError.name : 'UnknownError',
                publishErrorMessage: publishError instanceof Error ? publishError.message : String(publishError)
            });
        }
    }

    private toError(error: unknown): Error {
        return error instanceof Error ? error : new Error(String(error));
    }
}

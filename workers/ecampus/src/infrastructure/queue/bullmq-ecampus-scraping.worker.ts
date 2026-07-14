import { Worker, type Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { EcampusAuthService } from '@/infrastructure/ecampus-portal/ecampus-auth-service';
import { EcampusHttpRepository } from '@/infrastructure/ecampus-portal/ecampus-http.repository';
import { appLogger } from '@/infrastructure/logging/app-logger';
import { createRedisConnectionOptions } from '@/infrastructure/redis/redis-connection';
import {
    ECAMPUS_SCRAPE_QUEUE_NAME,
    type EcampusScrapeJobData,
    type EcampusScrapeJobName,
    type EncryptedEcampusScrapeJobData
} from '@/application/ports/ecampus-scrape-job';
import { RedisEcampusSessionCoordinator } from '@/infrastructure/redis/redis-ecampus-session-coordinator';
import { ProcessEcampusScrapeJobUseCase } from '@/application/use-cases/process-ecampus-scrape-job.usecase';
import { LoginEcampusSessionUseCase } from '@/application/use-cases/login-ecampus-session.usecase';
import { LogoutEcampusSessionUseCase } from '@/application/use-cases/logout-ecampus-session.usecase';
import { GetStudentProfileUseCase } from '@/application/use-cases/get-student-profile.usecase';
import { GetScheduleUseCase } from '@/application/use-cases/get-schedule.usecase';
import { GetGradesUseCase } from '@/application/use-cases/get-grades.usecase';
import { GetLessonPlanSubjectsUseCase } from '@/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetLessonPlanUseCase } from '@/application/use-cases/get-lesson-plan.usecase';
import { ReportEcampusScrapeFailureUseCase } from '@/application/use-cases/report-ecampus-scrape-failure.usecase';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';
import { RedisEcampusCacheStore } from '@/infrastructure/redis/redis-ecampus-cache.store';
import { RedisEcampusScrapeEventPublisher } from '@/infrastructure/redis/redis-ecampus-scrape-event.publisher';
import { decryptQueuePayload } from '@/infrastructure/crypto/ecampus-queue-payload-cipher';

export class EcampusScrapingWorker {
    private readonly redis = new Redis(createRedisConnectionOptions());
    private readonly publishedFailedJobIds = new Set<string>();
    private readonly processJob: ProcessEcampusScrapeJobUseCase;
    private readonly worker: Worker<EncryptedEcampusScrapeJobData>;

    constructor() {
        // ioredis emits 'error' on any connection blip (restart, network hiccup,
        // TLS handshake failure). With zero listeners that throws synchronously
        // and crashes the whole worker process — this is very likely the actual
        // cause of the worker "falling over" during a transient Redis issue that
        // has nothing to do with eCampus itself. ioredis reconnects on its own;
        // this only needs to stop the crash and leave a trail.
        this.redis.on('error', (error) => {
            appLogger.warning('eCampus worker Redis client reported a connection error.', {
                errorName: error.name,
                message: error.message
            });
        });

        const authService = new EcampusAuthService();
        const repository = new EcampusHttpRepository(authService);
        const sessions = new RedisEcampusSessionCoordinator(this.redis);
        const cache = new RedisEcampusCacheStore(this.redis);
        const events = new RedisEcampusScrapeEventPublisher(this.redis);
        const cacheAndPublish = new CacheAndPublishScrapedResource(sessions, cache, events);

        this.processJob = new ProcessEcampusScrapeJobUseCase(
            new LoginEcampusSessionUseCase(authService, sessions, events),
            new LogoutEcampusSessionUseCase(repository, cache, sessions),
            new GetStudentProfileUseCase(repository, sessions, cacheAndPublish),
            new GetScheduleUseCase(repository, sessions, cacheAndPublish),
            new GetGradesUseCase(repository, sessions, cacheAndPublish),
            new GetLessonPlanSubjectsUseCase(repository, sessions, cacheAndPublish),
            new GetLessonPlanUseCase(repository, sessions, cacheAndPublish),
            new ReportEcampusScrapeFailureUseCase(cache, sessions, events)
        );

        this.worker = new Worker<EncryptedEcampusScrapeJobData>(
            ECAMPUS_SCRAPE_QUEUE_NAME,
            (job) => this.process(job),
            {
                connection: createRedisConnectionOptions() as ConnectionOptions,
                concurrency: Number(process.env.ECAMPUS_SCRAPE_WORKER_CONCURRENCY || 4)
            }
        );

        this.worker.on('completed', (job) => {
            appLogger.info('eCampus scraping job completed.', {
                jobId: job.id,
                jobName: job.name
            });
        });

        this.worker.on('failed', (job, error) => {
            appLogger.error('eCampus scraping job failed.', {
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
                appLogger.warning('Transient eCampus scraping failure. Waiting for retry before notifying API.', {
                    jobId: job.id,
                    jobName: job.name,
                    attemptsMade: job.attemptsMade,
                    attempts: this.getConfiguredAttempts(job)
                });
            }
        });
    }

    async run(): Promise<void> {
        appLogger.info('eCampus scraping worker started.', {
            queue: ECAMPUS_SCRAPE_QUEUE_NAME,
            concurrency: Number(process.env.ECAMPUS_SCRAPE_WORKER_CONCURRENCY || 4)
        });
    }

    async close(): Promise<void> {
        await this.worker.close();
        await this.redis.quit();
    }

    private async process(job: Job<EncryptedEcampusScrapeJobData>): Promise<unknown> {
        const name = job.name as EcampusScrapeJobName;

        appLogger.info('Processing eCampus scraping job.', {
            jobId: job.id,
            jobName: name
        });

        try {
            return await this.processJob.execute(name, this.decryptJobData(job), job.id);
        } catch (error) {
            throw this.toError(error);
        }
    }

    private isTerminalFailure(job: Job<EncryptedEcampusScrapeJobData>): boolean {
        return job.attemptsMade >= this.getConfiguredAttempts(job);
    }

    private getConfiguredAttempts(job: Job<EncryptedEcampusScrapeJobData>): number {
        const attempts = Number(job.opts.attempts ?? 1);
        return Number.isFinite(attempts) && attempts > 0 ? attempts : 1;
    }

    private decryptJobData(job: Job<EncryptedEcampusScrapeJobData>): EcampusScrapeJobData {
        return decryptQueuePayload<EcampusScrapeJobData>(job.data.__enc);
    }

    private async publishFailedJob(job: Job<EncryptedEcampusScrapeJobData>, error: Error, origin: 'processor-catch' | 'worker-failed-listener'): Promise<void> {
        const jobId = job.id ?? `${job.name}:${job.timestamp}`;
        if (this.publishedFailedJobIds.has(jobId)) {
            return;
        }

        try {
            this.publishedFailedJobIds.add(jobId);
            const published = await this.processJob.handleFailure(job.name, this.decryptJobData(job), error);
            if (!published) {
                appLogger.warning('Skipped eCampus scraping failure notification without publishable job data.', {
                    jobId: job.id,
                    jobName: job.name,
                    origin,
                    errorName: error.name
                });
                return;
            }

            appLogger.warning('Published eCampus scraping failure notification.', {
                jobId: job.id,
                jobName: job.name,
                errorName: error.name,
                origin
            });
        } catch (publishError) {
            this.publishedFailedJobIds.delete(jobId);
            appLogger.error('Failed to publish eCampus scraping failure notification.', {
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

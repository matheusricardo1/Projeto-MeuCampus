import { Worker, type Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { RuDigitalActionResolver } from '@/infrastructure/ru-digital-portal/ru-digital-action-resolver';
import { RuDigitalAuthService } from '@/infrastructure/ru-digital-portal/ru-digital-auth-service';
import { RuDigitalHttpRepository } from '@/infrastructure/ru-digital-portal/ru-digital-http.repository';
import { appLogger } from '@/infrastructure/logging/app-logger';
import { createRedisConnectionOptions } from '@/infrastructure/redis/redis-connection';
import {
    RUDIGITAL_SCRAPE_QUEUE_NAME,
    type RuDigitalScrapeJobData,
    type RuDigitalScrapeJobName,
    type EncryptedRuDigitalScrapeJobData
} from '@/application/ports/ru-digital-scrape-job';
import { RedisRuDigitalSessionCoordinator } from '@/infrastructure/redis/redis-ru-digital-session-coordinator';
import { RedisRuDigitalCacheStore } from '@/infrastructure/redis/redis-ru-digital-cache.store';
import { RedisRuDigitalScrapeEventPublisher } from '@/infrastructure/redis/redis-ru-digital-scrape-event.publisher';
import { RedisRuDigitalActionMapStore } from '@/infrastructure/redis/redis-ru-digital-action-map.store';
import { ProcessRuDigitalScrapeJobUseCase } from '@/application/use-cases/process-ru-digital-scrape-job.usecase';
import { LoginRuDigitalSessionUseCase } from '@/application/use-cases/login-ru-digital-session.usecase';
import { LogoutRuDigitalSessionUseCase } from '@/application/use-cases/logout-ru-digital-session.usecase';
import { GetStudentUseCase } from '@/application/use-cases/get-student.usecase';
import { GetBalanceUseCase } from '@/application/use-cases/get-balance.usecase';
import { GetDailyMenuUseCase } from '@/application/use-cases/get-daily-menu.usecase';
import { GetDefaultRestaurantUseCase } from '@/application/use-cases/get-default-restaurant.usecase';
import { GetLastConsumptionUseCase } from '@/application/use-cases/get-last-consumption.usecase';
import { ListRestaurantsUseCase } from '@/application/use-cases/list-restaurants.usecase';
import { SelectDefaultRestaurantUseCase } from '@/application/use-cases/select-default-restaurant.usecase';
import { ReportRuDigitalScrapeFailureUseCase } from '@/application/use-cases/report-ru-digital-scrape-failure.usecase';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';
import { decryptQueuePayload } from '@/infrastructure/crypto/ru-digital-queue-payload-cipher';

const RUDIGITAL_BASE_URL = 'https://rudigital.ufam.edu.br';

export class RuDigitalScrapingWorker {
    private readonly redis = new Redis(createRedisConnectionOptions());
    private readonly publishedFailedJobIds = new Set<string>();
    private readonly processJob: ProcessRuDigitalScrapeJobUseCase;
    private readonly worker: Worker<EncryptedRuDigitalScrapeJobData>;

    constructor() {
        // Zero 'error' listeners on an ioredis client throws synchronously on
        // any connection blip and crashes the process — see workers/ecampus
        // for the same fix. ioredis reconnects on its own; this only stops
        // the crash and leaves a trail.
        this.redis.on('error', (error) => {
            appLogger.warning('RU Digital worker Redis client reported a connection error.', {
                errorName: error.name,
                message: error.message
            });
        });

        const actionMapStore = new RedisRuDigitalActionMapStore(this.redis);
        const resolver = new RuDigitalActionResolver(RUDIGITAL_BASE_URL, actionMapStore);
        const authService = new RuDigitalAuthService(resolver);
        const repository = new RuDigitalHttpRepository(authService);
        const sessions = new RedisRuDigitalSessionCoordinator(this.redis);
        const cache = new RedisRuDigitalCacheStore(this.redis);
        const events = new RedisRuDigitalScrapeEventPublisher(this.redis);
        const cacheAndPublish = new CacheAndPublishScrapedResource(sessions, cache, events);

        this.processJob = new ProcessRuDigitalScrapeJobUseCase(
            new LoginRuDigitalSessionUseCase(authService, sessions, events),
            new LogoutRuDigitalSessionUseCase(repository, cache, sessions),
            new GetStudentUseCase(repository, sessions, cacheAndPublish),
            new GetBalanceUseCase(repository, sessions, cacheAndPublish),
            new GetDailyMenuUseCase(repository, sessions, cacheAndPublish),
            new GetDefaultRestaurantUseCase(repository, sessions, cacheAndPublish),
            new GetLastConsumptionUseCase(repository, sessions, cacheAndPublish),
            new ListRestaurantsUseCase(repository, sessions, cacheAndPublish),
            new SelectDefaultRestaurantUseCase(repository, sessions),
            new ReportRuDigitalScrapeFailureUseCase(cache, sessions, events)
        );

        this.worker = new Worker<EncryptedRuDigitalScrapeJobData>(
            RUDIGITAL_SCRAPE_QUEUE_NAME,
            (job) => this.process(job),
            {
                connection: createRedisConnectionOptions() as ConnectionOptions,
                concurrency: Number(process.env.RUDIGITAL_SCRAPE_WORKER_CONCURRENCY || 10)
            }
        );

        this.worker.on('completed', (job) => {
            appLogger.info('RU Digital scraping job completed.', { jobId: job.id, jobName: job.name });
        });

        this.worker.on('failed', (job, error) => {
            appLogger.error('RU Digital scraping job failed.', {
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
                appLogger.warning('Transient RU Digital scraping failure. Waiting for retry before notifying API.', {
                    jobId: job.id,
                    jobName: job.name,
                    attemptsMade: job.attemptsMade,
                    attempts: this.getConfiguredAttempts(job)
                });
            }
        });
    }

    async run(): Promise<void> {
        appLogger.info('RU Digital scraping worker started.', {
            queue: RUDIGITAL_SCRAPE_QUEUE_NAME,
            concurrency: Number(process.env.RUDIGITAL_SCRAPE_WORKER_CONCURRENCY || 10)
        });
    }

    async close(): Promise<void> {
        await this.worker.close();
        await this.redis.quit();
    }

    private async process(job: Job<EncryptedRuDigitalScrapeJobData>): Promise<unknown> {
        const name = job.name as RuDigitalScrapeJobName;
        appLogger.info('Processing RU Digital scraping job.', { jobId: job.id, jobName: name });

        try {
            return await this.processJob.execute(name, this.decryptJobData(job), job.id);
        } catch (error) {
            throw this.toError(error);
        }
    }

    private isTerminalFailure(job: Job<EncryptedRuDigitalScrapeJobData>): boolean {
        return job.attemptsMade >= this.getConfiguredAttempts(job);
    }

    private getConfiguredAttempts(job: Job<EncryptedRuDigitalScrapeJobData>): number {
        const attempts = Number(job.opts.attempts ?? 1);
        return Number.isFinite(attempts) && attempts > 0 ? attempts : 1;
    }

    private decryptJobData(job: Job<EncryptedRuDigitalScrapeJobData>): RuDigitalScrapeJobData {
        return decryptQueuePayload<RuDigitalScrapeJobData>(job.data.__enc);
    }

    private async publishFailedJob(job: Job<EncryptedRuDigitalScrapeJobData>, error: Error, origin: 'processor-catch' | 'worker-failed-listener'): Promise<void> {
        const jobId = job.id ?? `${job.name}:${job.timestamp}`;
        if (this.publishedFailedJobIds.has(jobId)) {
            return;
        }

        try {
            this.publishedFailedJobIds.add(jobId);
            const published = await this.processJob.handleFailure(job.name, this.decryptJobData(job), error);
            if (!published) {
                appLogger.warning('Skipped RU Digital scraping failure notification without publishable job data.', {
                    jobId: job.id,
                    jobName: job.name,
                    origin,
                    errorName: error.name
                });
                return;
            }

            appLogger.warning('Published RU Digital scraping failure notification.', {
                jobId: job.id,
                jobName: job.name,
                errorName: error.name,
                origin
            });
        } catch (publishError) {
            this.publishedFailedJobIds.delete(jobId);
            appLogger.error('Failed to publish RU Digital scraping failure notification.', {
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

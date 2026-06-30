import { Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { EcampusAuthService } from '@ecampus/infrastructure/ecampus/ecampus-auth-service';
import { EcampusHttpRepository } from '@ecampus/infrastructure/ecampus/ecampus-http.repository';
import { appLogger } from '@/logging/app-logger';
import { createRedisConnectionOptions } from '@/redis-connection';
import {
    ECAMPUS_SCRAPE_QUEUE_NAME,
    type EcampusScrapeJobData,
    type EcampusScrapeJobName
} from '@/ecampus-scrape-job';
import { EcampusSessionCoordinator } from '@/ecampus-session-coordinator';
import { ProcessEcampusScrapeJobUseCase } from '@/application/use-cases/process-ecampus-scrape-job.usecase';
import { RedisEcampusCacheStore } from '@/infrastructure/redis/redis-ecampus-cache.store';
import { RedisEcampusScrapeEventPublisher } from '@/infrastructure/redis/redis-ecampus-scrape-event.publisher';

export class EcampusScrapingWorker {
    private readonly redis = new Redis(createRedisConnectionOptions());
    private readonly publishedFailedJobIds = new Set<string>();
    private readonly processJob: ProcessEcampusScrapeJobUseCase;
    private readonly worker: Worker<EcampusScrapeJobData>;

    constructor() {
        const authService = new EcampusAuthService();
        const repository = new EcampusHttpRepository(authService);
        const sessions = new EcampusSessionCoordinator(this.redis);
        const cache = new RedisEcampusCacheStore(this.redis);
        const events = new RedisEcampusScrapeEventPublisher(this.redis);

        this.processJob = new ProcessEcampusScrapeJobUseCase(
            repository,
            authService,
            sessions,
            cache,
            events
        );

        this.worker = new Worker<EcampusScrapeJobData>(
            ECAMPUS_SCRAPE_QUEUE_NAME,
            (job) => this.process(job),
            {
                connection: createRedisConnectionOptions(),
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

            if (job) {
                void this.publishFailedJob(job, error, 'worker-failed-listener');
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

    private async process(job: Job<EcampusScrapeJobData>): Promise<unknown> {
        const name = job.name as EcampusScrapeJobName;

        appLogger.info('Processing eCampus scraping job.', {
            jobId: job.id,
            jobName: name
        });

        try {
            return await this.processJob.execute(name, job.data);
        } catch (error) {
            const normalizedError = this.toError(error);
            await this.publishFailedJob(job, normalizedError, 'processor-catch');
            throw normalizedError;
        }
    }

    private async publishFailedJob(job: Job<EcampusScrapeJobData>, error: Error, origin: 'processor-catch' | 'worker-failed-listener'): Promise<void> {
        const jobId = job.id ?? `${job.name}:${job.timestamp}`;
        if (this.publishedFailedJobIds.has(jobId)) {
            return;
        }

        try {
            this.publishedFailedJobIds.add(jobId);
            const published = await this.processJob.handleFailure(job.name, job.data, error);
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

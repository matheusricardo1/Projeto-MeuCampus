import { Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { EcampusAuthService } from '@ecampus/infrastructure/ecampus/ecampus-auth-service';
import { EcampusHttpRepository } from '@ecampus/infrastructure/ecampus/ecampus-http.repository';
import { appLogger } from '@/logging/app-logger';
import { createRedisConnectionOptions } from './redis-connection';
import {
    ECAMPUS_SCRAPE_QUEUE_NAME,
    type EcampusScrapeJobData,
    type EcampusScrapeJobName
} from './ecampus-scrape-job';
import { getEcampusCacheKey, getEcampusUserCachePattern, type EcampusCachedResource } from './ecampus-cache';
import { ECAMPUS_SCRAPE_RESULT_CHANNEL, type EcampusResourceFailedEvent, type EcampusResourceReadyEvent } from './ecampus-scrape-events';
import { getCurrentAcademicPeriod } from '@ecampus/domain/services/current-academic-period';
import { EcampusSessionCoordinator } from './ecampus-session-coordinator';

type AuthenticatedScrapeJobData = Extract<EcampusScrapeJobData, { credentials: unknown }>;

export class EcampusScrapingWorker {
    private readonly repository = new EcampusHttpRepository(new EcampusAuthService());
    private readonly redis = new Redis(createRedisConnectionOptions());
    private readonly sessions = new EcampusSessionCoordinator(this.redis);
    private readonly publishedFailedJobIds = new Set<string>();
    private readonly worker: Worker<EcampusScrapeJobData>;

    constructor() {
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
        const data = job.data;

        appLogger.info('Processing eCampus scraping job.', {
            jobId: job.id,
            jobName: name
        });

        if (name === 'login') {
            const { cpf, password } = data as { cpf: string; password: string };
            const authService = new EcampusAuthService();
            const session = await authService.authenticate({ cpf }, password);
            await this.sessions.markActive(cpf);
            return { session };
        }

        const authenticatedData = data as AuthenticatedScrapeJobData;

        try {
            switch (name) {
                case 'logout':
                    return this.logoutAndClearCache(authenticatedData.credentials);
                case 'profile': {
                    await this.sessions.assertActive(authenticatedData.credentials.cpf);
                    return this.cacheAndPublish('profile', authenticatedData.credentials, this.repository.getStudentProfile(authenticatedData.credentials));
                }
                case 'schedule': {
                    await this.sessions.assertActive(authenticatedData.credentials.cpf);
                    return this.cacheAndPublish('schedule', authenticatedData.credentials, this.repository.getSchedule(authenticatedData.credentials));
                }
                case 'grades': {
                    await this.sessions.assertActive(authenticatedData.credentials.cpf);
                    const { year, period } = this.resolveGradesPeriod(authenticatedData);
                    return this.cacheAndPublish('grades', authenticatedData.credentials, this.repository.getGrades(authenticatedData.credentials, year, period), { year, period });
                }
                case 'lesson-plan-subjects': {
                    await this.sessions.assertActive(authenticatedData.credentials.cpf);
                    return this.cacheAndPublish('lesson-plan-subjects', authenticatedData.credentials, this.repository.getLessonPlanSubjects(authenticatedData.credentials));
                }
                case 'lesson-plan': {
                    await this.sessions.assertActive(authenticatedData.credentials.cpf);
                    const planId = this.requireField(authenticatedData, 'planId');
                    return this.cacheAndPublish('lesson-plan', authenticatedData.credentials, this.repository.getLessonPlan(authenticatedData.credentials, planId), { planId });
                }
                default:
                    throw new Error(`Unsupported eCampus scraping job: ${name}`);
            }
        } catch (error) {
            const normalizedError = this.toError(error);
            await this.publishFailedJob(job, normalizedError, 'processor-catch');
            throw normalizedError;
        }
    }

    private async logoutAndClearCache(credentials: { cpf: string }): Promise<{ cacheDeletedKeys: number; externalLogout: 'ok' | 'failed' }> {
        let externalLogout: 'ok' | 'failed' = 'ok';

        try {
            await this.repository.logout(credentials);
        } catch (error) {
            externalLogout = 'failed';
            appLogger.warning('eCampus remote logout failed; local cache will still be cleared.', {
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
        }

        const cacheDeletedKeys = await this.clearUserCache(credentials.cpf);
        await this.sessions.markInvalid(credentials.cpf, 'logout');
        appLogger.info('Cleared eCampus cached data after logout.', {
            cacheDeletedKeys
        });

        return { cacheDeletedKeys, externalLogout };
    }

    private requireField<T extends string>(data: Record<string, unknown>, field: T): string {
        const value = data[field];
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error(`Missing required job field: ${field}`);
        }

        return value;
    }

    private resolveGradesPeriod(data: Record<string, unknown>): { year: string; period: string } {
        const fallback = getCurrentAcademicPeriod();
        const year = typeof data.year === 'string' && data.year.trim()
            ? data.year.trim()
            : fallback.year;
        const period = typeof data.period === 'string' && data.period.trim()
            ? data.period.trim()
            : fallback.period;

        return { year, period };
    }

    private async clearUserCache(cpf: string): Promise<number> {
        const pattern = getEcampusUserCachePattern(cpf);
        let cursor = '0';
        let deletedKeys = 0;

        do {
            const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;

            if (keys.length > 0) {
                deletedKeys += await this.redis.del(...keys);
            }
        } while (cursor !== '0');

        return deletedKeys;
    }

    private async cacheAndPublish<T>(
        resource: EcampusCachedResource,
        credentials: { cpf: string },
        resultPromise: Promise<T>,
        parameters: Pick<EcampusResourceReadyEvent, 'year' | 'period' | 'planId'> = {}
    ): Promise<T> {
        const result = await resultPromise;
        await this.sessions.assertActive(credentials.cpf);
        const extra = resource === 'grades'
            ? `${parameters.year}-${parameters.period}`
            : resource === 'lesson-plan'
                ? parameters.planId
                : undefined;

        await this.redis.set(getEcampusCacheKey(resource, credentials.cpf, extra), JSON.stringify(result), 'EX', 3600);
        await this.redis.publish(ECAMPUS_SCRAPE_RESULT_CHANNEL, JSON.stringify({
            cpf: credentials.cpf,
            resource,
            ...parameters
        } satisfies EcampusResourceReadyEvent));

        return result;
    }

    private async publishFailedJob(job: Job<EcampusScrapeJobData>, error: Error, origin: 'processor-catch' | 'worker-failed-listener'): Promise<void> {
        const jobId = job.id ?? `${job.name}:${job.timestamp}`;
        if (this.publishedFailedJobIds.has(jobId)) {
            return;
        }

        const resource = this.toCachedResource(job.name);
        if (!resource || !('credentials' in job.data)) {
            appLogger.warning('Skipped eCampus scraping failure notification without publishable job data.', {
                jobId: job.id,
                jobName: job.name,
                origin,
                hasResource: Boolean(resource),
                hasCredentials: 'credentials' in job.data,
                errorName: error.name
            });
            return;
        }

        const event: EcampusResourceFailedEvent = {
            cpf: job.data.credentials.cpf,
            resource,
            status: 'failed',
            errorName: error.name,
            message: error.message,
            ...this.getEventParameters(resource, job.data)
        };

        if (error.name === 'AuthenticationError') {
            await this.invalidateLocalSessionAfterAuthenticationFailure(event.cpf);
        }

        try {
            this.publishedFailedJobIds.add(jobId);
            await this.redis.publish(ECAMPUS_SCRAPE_RESULT_CHANNEL, JSON.stringify(event));
            appLogger.warning('Published eCampus scraping failure notification.', {
                channel: ECAMPUS_SCRAPE_RESULT_CHANNEL,
                jobId: job.id,
                jobName: job.name,
                resource,
                errorName: error.name,
                origin
            });
        } catch (publishError) {
            this.publishedFailedJobIds.delete(jobId);
            appLogger.error('Failed to publish eCampus scraping failure notification.', {
                channel: ECAMPUS_SCRAPE_RESULT_CHANNEL,
                jobId: job.id,
                jobName: job.name,
                resource,
                errorName: error.name,
                origin,
                publishErrorName: publishError instanceof Error ? publishError.name : 'UnknownError',
                publishErrorMessage: publishError instanceof Error ? publishError.message : String(publishError)
            });
        }
    }

    private async invalidateLocalSessionAfterAuthenticationFailure(cpf: string): Promise<void> {
        const [cacheDeletedKeys] = await Promise.all([
            this.clearUserCache(cpf),
            this.sessions.markInvalid(cpf, 'authentication-failure')
        ]);

        appLogger.warning('Invalidated eCampus session after authentication failure.', {
            cacheDeletedKeys
        });
    }

    private toError(error: unknown): Error {
        return error instanceof Error ? error : new Error(String(error));
    }

    private toCachedResource(name: string): EcampusCachedResource | null {
        return ['profile', 'schedule', 'grades', 'lesson-plan-subjects', 'lesson-plan'].includes(name)
            ? name as EcampusCachedResource
            : null;
    }

    private getEventParameters(
        resource: EcampusCachedResource,
        data: EcampusScrapeJobData
    ): Pick<EcampusResourceReadyEvent, 'year' | 'period' | 'planId'> {
        if (resource === 'grades') {
            return this.resolveGradesPeriod(data);
        }

        if (resource === 'lesson-plan' && 'planId' in data) {
            return { planId: data.planId };
        }

        return {};
    }
}

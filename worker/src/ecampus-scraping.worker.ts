import { Worker, type Job } from 'bullmq';
import { EcampusAuthService } from '@ecampus/infrastructure/ecampus/ecampus-auth-service';
import { EcampusHttpRepository } from '@ecampus/infrastructure/ecampus/ecampus-http.repository';
import { appLogger } from '@/logging/app-logger';
import { createRedisConnectionOptions } from './redis-connection';
import {
    ECAMPUS_SCRAPE_QUEUE_NAME,
    type EcampusScrapeJobData,
    type EcampusScrapeJobName
} from './ecampus-scrape-job';

export class EcampusScrapingWorker {
    private readonly repository = new EcampusHttpRepository(new EcampusAuthService());
    private readonly worker: Worker<EcampusScrapeJobData>;

    constructor() {
        this.worker = new Worker<EcampusScrapeJobData>(
            ECAMPUS_SCRAPE_QUEUE_NAME,
            (job) => this.process(job),
            {
                connection: createRedisConnectionOptions(),
                concurrency: Number(process.env.ECAMPUS_SCRAPE_WORKER_CONCURRENCY || 2)
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
        });
    }

    async run(): Promise<void> {
        appLogger.info('eCampus scraping worker started.', {
            queue: ECAMPUS_SCRAPE_QUEUE_NAME,
            concurrency: Number(process.env.ECAMPUS_SCRAPE_WORKER_CONCURRENCY || 2)
        });
    }

    async close(): Promise<void> {
        await this.worker.close();
    }

    private async process(job: Job<EcampusScrapeJobData>): Promise<unknown> {
        const name = job.name as EcampusScrapeJobName;
        const data = job.data;

        appLogger.info('Processing eCampus scraping job.', {
            jobId: job.id,
            jobName: name
        });

        switch (name) {
            case 'profile':
                return this.repository.getStudentProfile(data.credentials);
            case 'schedule':
                return this.repository.getSchedule(data.credentials);
            case 'grades':
                return this.repository.getGrades(data.credentials, this.requireField(data, 'year'), this.requireField(data, 'period'));
            case 'lesson-plan-subjects':
                return this.repository.getLessonPlanSubjects(data.credentials);
            case 'lesson-plan':
                return this.repository.getLessonPlan(data.credentials, this.requireField(data, 'planId'));
            default:
                throw new Error(`Unsupported eCampus scraping job: ${name}`);
        }
    }

    private requireField<T extends string>(data: Record<string, unknown>, field: T): string {
        const value = data[field];
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error(`Missing required job field: ${field}`);
        }

        return value;
    }
}


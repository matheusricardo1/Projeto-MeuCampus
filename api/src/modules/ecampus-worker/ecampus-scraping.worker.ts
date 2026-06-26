import { Worker, type Job } from 'bullmq';
import { EcampusAuthService } from '@ecampus/infrastructure/ecampus/ecampus-auth-service';
import { EcampusHttpRepository } from '@ecampus/infrastructure/ecampus/ecampus-http.repository';
import { appLogger } from '@/shared/logging/app-logger';
import { createRedisConnectionOptions } from './redis-connection';
import {
    ECAMPUS_SCRAPE_QUEUE_NAME,
    type EcampusScrapeJobData,
    type EcampusScrapeJobName
} from '@/shared/ecampus-scrape-job';

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

        // Login job has a different payload (cpf & password). Handle it separately.
        if (name === 'login') {
            const { cpf, password } = data as { cpf: string; password: string };
            const auth = new EcampusAuthService();
            const session = await auth.authenticate({ cpf, password } as any, password);
            return { session };
        }

        // All other jobs carry an authenticated credentials object.
        const { credentials } = data as { credentials: any };

        switch (name) {
            case 'profile':
                return this.repository.getStudentProfile(credentials);
            case 'schedule':
                return this.repository.getSchedule(credentials);
            case 'grades':
                return this.repository.getGrades(
                    credentials,
                    this.requireField(data, 'year'),
                    this.requireField(data, 'period'),
                );
            case 'lesson-plan-subjects':
                return this.repository.getLessonPlanSubjects(credentials);
            case 'lesson-plan':
                return this.repository.getLessonPlan(credentials, this.requireField(data, 'planId'));
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


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

export class EcampusScrapingWorker {
    private readonly repository = new EcampusHttpRepository(new EcampusAuthService());
    private readonly redis = new (require('ioredis'))(createRedisConnectionOptions());
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

        // @ts-ignore – add login case
    switch (name) {
            case 'profile': {
                const result = await this.repository.getStudentProfile(data.credentials);
                await this.redis.set(`ecampus:result:${data.credentials.cpf}:profile`, JSON.stringify(result), 'EX', 3600);
                return result;
            }
            case 'schedule': {
                const result = await this.repository.getSchedule(data.credentials);
                await this.redis.set(`ecampus:result:${data.credentials.cpf}:schedule`, JSON.stringify(result), 'EX', 3600);
                return result;
            }
            case 'grades': {
                const result = await this.repository.getGrades(
                    data.credentials,
                    this.requireField(data, 'year'),
                    this.requireField(data, 'period')
                );
                await this.redis.set(`ecampus:result:${data.credentials.cpf}:grades`, JSON.stringify(result), 'EX', 3600);
                return result;
            }
            case 'lesson-plan-subjects': {
                const result = await this.repository.getLessonPlanSubjects(data.credentials);
                await this.redis.set(`ecampus:result:${data.credentials.cpf}:lesson-plan-subjects`, JSON.stringify(result), 'EX', 3600);
                return result;
            }
            case 'lesson-plan': {
                const planId = this.requireField(data, 'planId');
                const result = await this.repository.getLessonPlan(data.credentials, planId);
                await this.redis.set(`ecampus:result:${data.credentials.cpf}:lesson-plan:${planId}`, JSON.stringify(result), 'EX', 3600);
                return result;
            }
            case 'login': {
                // data contains { cpf, password }
                const authService = new EcampusAuthService();
                const session = await authService.authenticate({ cpf: (data as any).cpf }, (data as any).password);
                // Store session in Redis for later API lookup (optional)
                await this.redis.set(`ecampus:session:${(data as any).cpf}`, JSON.stringify({ session }), 'EX', 3600);
                // Return the raw session object – the API will encrypt it later
                return { session };
            }
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


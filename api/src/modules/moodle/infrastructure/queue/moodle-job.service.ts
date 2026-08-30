import { Injectable } from '@nestjs/common';
import { Queue, QueueEvents, type Job, type JobsOptions } from 'bullmq';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { encryptQueuePayload } from '@/shared/security/moodle-queue-payload-cipher';
import { MOODLE_SYNC_QUEUE_NAME } from '@moodle/infrastructure/queue/moodle-sync-job';
import { ScrapingJobService, type EnqueueJobOptions, type QueuedJob } from '@academic/application/ports/scraping-job-service';

interface EncryptedJobData {
    __enc: string;
}

const reusableJobStates = new Set(['waiting', 'active', 'delayed', 'prioritized', 'waiting-children', 'paused']);

@Injectable()
export class MoodleScrapingJobService extends ScrapingJobService {
    private readonly queue: Queue;
    private readonly queueEvents: QueueEvents;

    constructor() {
        super();
        this.queue = new Queue(MOODLE_SYNC_QUEUE_NAME, { connection: createRedisConnectionOptions() });
        this.queueEvents = new QueueEvents(MOODLE_SYNC_QUEUE_NAME, { connection: createRedisConnectionOptions() });
    }

    async enqueue<Result = unknown>(name: string, data: Record<string, unknown>, options: EnqueueJobOptions = {}): Promise<QueuedJob<Result>> {
        const jobId = options.dedupeKey ? this.toJobId(options.dedupeKey) : undefined;
        if (jobId) {
            const existingJob = await this.queue.getJob(jobId);
            if (existingJob) {
                const state = await existingJob.getState();
                if (reusableJobStates.has(state)) {
                    return this.toQueuedJob(existingJob);
                }

                await existingJob.remove().catch(() => undefined);
            }
        }

        const jobOptions: JobsOptions = {
            ...this.getCleanupOptions(name),
            ...(jobId ? { jobId } : {})
        };

        const encryptedData: EncryptedJobData = { __enc: encryptQueuePayload(data) };
        return this.toQueuedJob(await this.queue.add(name, encryptedData, jobOptions));
    }

    private toQueuedJob<Result>(job: Job): QueuedJob<Result> {
        const queuedJob: QueuedJob<Result> = {
            waitUntilFinished: (timeoutMs?: number) => job.waitUntilFinished(this.queueEvents, timeoutMs) as Promise<Result>
        };

        if (job.id !== undefined) {
            queuedJob.id = job.id;
        }

        return queuedJob;
    }

    private toJobId(dedupeKey: string): string {
        return `moodle-sync-${dedupeKey}`
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    private getCleanupOptions(name: string): JobsOptions {
        if (name === 'login') {
            // Carries the Moodle password (encrypted, but still the single
            // most sensitive payload) — drop it from Redis as soon as it's done.
            return {
                removeOnComplete: true,
                removeOnFail: { count: 0 }
            };
        }

        return {
            removeOnComplete: { count: 50, age: 300 },
            removeOnFail: { count: 200, age: 3600 }
        };
    }
}

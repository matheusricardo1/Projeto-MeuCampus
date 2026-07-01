import { Injectable } from '@nestjs/common';
import { Queue, QueueEvents, type Job, type JobsOptions } from 'bullmq';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { ECAMPUS_SCRAPE_QUEUE_NAME } from '@ecampus/infrastructure/queue/ecampus-scrape-job';
import { ScrapingJobService, type EnqueueJobOptions, type QueuedJob } from '@academic/application/ports/scraping-job-service';

const reusableJobStates = new Set(['waiting', 'active', 'delayed', 'prioritized', 'waiting-children', 'paused']);

@Injectable()
export class EcampusScrapingJobService extends ScrapingJobService {
  private readonly queue: Queue;
  private readonly queueEvents: QueueEvents;

  constructor() {
    super();
    this.queue = new Queue(ECAMPUS_SCRAPE_QUEUE_NAME, {
      connection: createRedisConnectionOptions(),
    });
    this.queueEvents = new QueueEvents(ECAMPUS_SCRAPE_QUEUE_NAME, {
      connection: createRedisConnectionOptions(),
    });
  }

  /**
   * Enqueue a job of the given name with the supplied data.
   * The caller is responsible for providing the correct shape of `data`
   * matching the job type.
   */
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
      ...this.getRetryOptions(name),
      ...(jobId ? { jobId } : {})
    };

    return this.toQueuedJob(await this.queue.add(name, data, jobOptions));
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
    return `ecampus-scrape-${dedupeKey}`
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getRetryOptions(name: string): JobsOptions {
    if (!['profile', 'schedule', 'grades', 'lesson-plan-subjects', 'lesson-plan'].includes(name)) {
      return {};
    }

    return {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1500
      }
    };
  }
}

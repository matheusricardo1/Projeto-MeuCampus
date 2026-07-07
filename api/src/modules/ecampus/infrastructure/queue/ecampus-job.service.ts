import { Injectable } from '@nestjs/common';
import { Queue, QueueEvents, type Job, type JobsOptions } from 'bullmq';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { encryptQueuePayload } from '@/shared/security/ecampus-queue-payload-cipher';
import { ECAMPUS_SCRAPE_QUEUE_NAME } from '@ecampus/infrastructure/queue/ecampus-scrape-job';
import { ScrapingJobService, type EnqueueJobOptions, type QueuedJob } from '@academic/application/ports/scraping-job-service';

/**
 * Wire shape stored in BullMQ. Job data always carries a CPF/password or a
 * session cookie jar — both sensitive — so it is encrypted end-to-end
 * instead of sitting in Redis as plain JSON while the job waits/retries.
 */
export interface EncryptedJobData {
  __enc: string;
}

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
    return `ecampus-scrape-${dedupeKey}`
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getCleanupOptions(name: string): JobsOptions {
    if (name === 'login') {
      // The login job carries the eCampus password (encrypted, but still the
      // single most sensitive payload) — drop it from Redis as soon as it's
      // done instead of leaving it around for BullMQ's default retention.
      return {
        removeOnComplete: true,
        removeOnFail: { count: 0 }
      };
    }

    if (['logout', 'profile', 'schedule', 'grades', 'lesson-plan-subjects', 'lesson-plan'].includes(name)) {
      // These jobs only carry an encrypted session cookie (not a password),
      // run far more often (prefetch, cache refresh, AI-triggered lookups),
      // and their result already lives in the encrypted ecampus:result:*
      // cache — so the job record itself doesn't need zero retention, just
      // a short one that still leaves room to debug failures.
      return {
        removeOnComplete: { count: 50, age: 300 },
        removeOnFail: { count: 200, age: 3600 }
      };
    }

    return {};
  }
}

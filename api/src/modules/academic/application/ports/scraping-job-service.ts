/**
 * Allows the application layer to enqueue scraping jobs and optionally wait
 * for their completion.
 */
export interface QueuedJob<Result = unknown> {
  id?: string | number;
  waitUntilFinished(timeoutMs?: number): Promise<Result>;
}

export interface EnqueueJobOptions {
  dedupeKey?: string;
}

export abstract class ScrapingJobService {
  abstract enqueue<Result = unknown>(name: string, data: Record<string, unknown>, options?: EnqueueJobOptions): Promise<QueuedJob<Result>>;
}

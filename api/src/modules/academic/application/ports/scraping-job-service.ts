import { Job } from 'bullmq';

/**
 * Allows the application layer to enqueue scraping jobs and optionally wait
 * for their completion.
 */
export abstract class ScrapingJobService {
  abstract enqueue(name: string, data: Record<string, unknown>): Promise<Job>;
  abstract getQueue(): import('bullmq').Queue;
  abstract getQueueEvents(): import('bullmq').QueueEvents;
}

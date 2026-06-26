import { Injectable } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { ECAMPUS_SCRAPE_QUEUE_NAME } from '@/shared/ecampus-scrape-job';

@Injectable()
export class EcampusJobService {
  private readonly queue: Queue;
  private readonly queueEvents: QueueEvents;

  constructor() {
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
  async enqueue(name: string, data: Record<string, unknown>) {
    return this.queue.add(name, data);
  }

  /** Expose the underlying BullMQ Queue (needed to enqueue jobs). */
  getQueue(): Queue {
    return this.queue;
  }

  /** Expose QueueEvents for awaiting job completion. */
  getQueueEvents(): QueueEvents {
    return this.queueEvents;
  }
}

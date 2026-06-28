import { Injectable } from '@nestjs/common';
import { Queue, QueueEvents, type Job } from 'bullmq';
import { AiJobService, type AiChatJobData, type QueuedAiJob } from '@ai/application/ports/ai-job-service';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { AI_CHAT_QUEUE_NAME } from '@ai/infrastructure/queue/ai-chat-job';

@Injectable()
export class AiChatJobService extends AiJobService {
    private readonly queue: Queue<AiChatJobData>;
    private readonly queueEvents: QueueEvents;

    constructor() {
        super();
        this.queue = new Queue<AiChatJobData>(AI_CHAT_QUEUE_NAME, {
            connection: createRedisConnectionOptions()
        });
        this.queueEvents = new QueueEvents(AI_CHAT_QUEUE_NAME, {
            connection: createRedisConnectionOptions()
        });
    }

    async enqueue<Result = unknown>(data: AiChatJobData): Promise<QueuedAiJob<Result>> {
        const job = await this.queue.add('chat-message', data, {
            attempts: 2,
            backoff: {
                type: 'exponential',
                delay: 1000
            },
            removeOnComplete: 100,
            removeOnFail: 200
        });

        return this.toQueuedJob(job);
    }

    private toQueuedJob<Result>(job: Job<AiChatJobData>): QueuedAiJob<Result> {
        const queuedJob: QueuedAiJob<Result> = {
            waitUntilFinished: (timeoutMs?: number) => job.waitUntilFinished(this.queueEvents, timeoutMs) as Promise<Result>
        };

        if (job.id !== undefined) {
            queuedJob.id = job.id;
        }

        return queuedJob;
    }
}

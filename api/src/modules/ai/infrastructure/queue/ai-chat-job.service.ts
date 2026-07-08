import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AiJobService, type AiChatJobData } from '@ai/application/ports/ai-job-service';
import { createApiRedisConnectionOptions } from '@/shared/redis-connection';
import { AI_CHAT_QUEUE_NAME } from '@ai/infrastructure/queue/ai-chat-job';
import { AiChatCancelPublisher } from '@ai/infrastructure/redis/ai-chat-cancel.publisher';

@Injectable()
export class AiChatJobService extends AiJobService {
    private readonly queue: Queue<AiChatJobData>;

    constructor(private readonly cancelPublisher: AiChatCancelPublisher) {
        super();
        this.queue = new Queue<AiChatJobData>(AI_CHAT_QUEUE_NAME, {
            connection: createApiRedisConnectionOptions()
        });
    }

    async enqueue(data: AiChatJobData): Promise<{ id: string }> {
        const job = await this.queue.add('chat-message', data, {
            // Explicit UUID instead of BullMQ's default sequential job id —
            // a guessable id would let one authenticated user cancel another
            // user's in-flight generation.
            jobId: randomUUID(),
            attempts: 2,
            backoff: {
                type: 'exponential',
                delay: 1000
            },
            removeOnComplete: 100,
            removeOnFail: 200
        });

        return { id: String(job.id) };
    }

    async cancel(jobId: string): Promise<void> {
        const job = await this.queue.getJob(jobId);
        if (job) {
            const state = await job.getState();
            if (state === 'waiting' || state === 'delayed') {
                await job.remove();
            }
        }

        // Publish regardless — if the job is already active, this is what
        // reaches the worker's in-flight AbortController; if it was just
        // removed above, this is a harmless no-op on the worker side.
        await this.cancelPublisher.publish(jobId);
    }
}

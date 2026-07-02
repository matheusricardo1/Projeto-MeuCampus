import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AiJobService, type AiChatJobData } from '@ai/application/ports/ai-job-service';
import { createApiRedisConnectionOptions } from '@/shared/redis-connection';
import { AI_CHAT_QUEUE_NAME } from '@ai/infrastructure/queue/ai-chat-job';

@Injectable()
export class AiChatJobService extends AiJobService {
    private readonly queue: Queue<AiChatJobData>;

    constructor() {
        super();
        this.queue = new Queue<AiChatJobData>(AI_CHAT_QUEUE_NAME, {
            connection: createApiRedisConnectionOptions()
        });
    }

    async enqueue(data: AiChatJobData): Promise<{ id: string }> {
        const job = await this.queue.add('chat-message', data, {
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
}

import { Injectable } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { AiJobService } from '@ai/application/ports/ai-job-service';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { AI_CHAT_QUEUE_NAME, type AiChatJobData } from '@/shared/ai-chat-job';

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

    enqueue(data: AiChatJobData) {
        return this.queue.add('chat-message', data, {
            attempts: 2,
            backoff: {
                type: 'exponential',
                delay: 1000
            },
            removeOnComplete: 100,
            removeOnFail: 200
        });
    }

    getQueue(): Queue<AiChatJobData> {
        return this.queue;
    }

    getQueueEvents(): QueueEvents {
        return this.queueEvents;
    }
}

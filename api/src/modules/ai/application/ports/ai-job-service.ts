import type { Job, Queue, QueueEvents } from 'bullmq';
import type { AiChatJobData } from '@ai/application/services/ai-chat-job';

export abstract class AiJobService {
    abstract enqueue(data: AiChatJobData): Promise<Job<AiChatJobData>>;
    abstract getQueue(): Queue<AiChatJobData>;
    abstract getQueueEvents(): QueueEvents;
}

import type { AiChatMessage } from '@ai/domain/entities/ai-chat-message.entity';

export interface AiChatJobData {
    conversationId?: string;
    userId: string;
    message: string;
    history: AiChatMessage[];
}

export interface QueuedAiJob<Result = unknown> {
    id?: string | number;
    waitUntilFinished(timeoutMs?: number): Promise<Result>;
}

export abstract class AiJobService {
    abstract enqueue<Result = unknown>(data: AiChatJobData): Promise<QueuedAiJob<Result>>;
}

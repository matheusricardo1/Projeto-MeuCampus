import type { AiChatMessage } from '@ai/domain/entities/ai-chat-message.entity';

export interface AiChatJobData {
    conversationId?: string;
    userId: string;
    message: string;
    history: AiChatMessage[];
}

export abstract class AiJobService {
    abstract enqueue(data: AiChatJobData): Promise<{ id: string }>;
}

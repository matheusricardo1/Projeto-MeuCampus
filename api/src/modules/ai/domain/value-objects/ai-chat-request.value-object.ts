import type { AiChatMessage } from '@ai/domain/entities/ai-chat-message.entity';

export interface AiChatRequest {
    conversationId?: string;
    userId: string;
    message: string;
    history: AiChatMessage[];
}

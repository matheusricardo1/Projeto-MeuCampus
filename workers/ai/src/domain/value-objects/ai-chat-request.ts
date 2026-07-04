import type { AiChatMessage } from '@/domain/entities/ai-chat-message';

export interface AiChatRequest {
    conversationId?: string;
    userId: string;
    message: string;
    history: AiChatMessage[];
}

import type { AiChatMessage } from '@/domain/entities/ai-chat-message';

export interface AiChatReply {
    conversationId: string;
    message: AiChatMessage;
}

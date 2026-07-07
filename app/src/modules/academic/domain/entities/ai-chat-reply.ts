import type { AiChatMessage } from '@/modules/academic/domain/entities/ai-chat-message';

export interface AiChatReply {
    conversationId: string;
    message: AiChatMessage;
}

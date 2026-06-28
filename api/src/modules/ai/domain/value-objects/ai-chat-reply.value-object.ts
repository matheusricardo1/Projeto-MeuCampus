import type { AiChatMessage } from '@ai/domain/entities/ai-chat-message.entity';

export interface AiChatReply {
    conversationId: string;
    message: AiChatMessage;
}

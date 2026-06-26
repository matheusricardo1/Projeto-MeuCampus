import type { AiChatMessage } from '@ai/domain/models/ai-chat-message';

export interface AiChatReply {
    conversationId: string;
    message: AiChatMessage;
}

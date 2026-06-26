import type { AiChatMessage } from '@/models/ai-chat-message';

export interface AiChatReply {
    conversationId: string;
    message: AiChatMessage;
}

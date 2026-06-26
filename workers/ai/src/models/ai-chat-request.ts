import type { AiChatMessage } from '@/models/ai-chat-message';

export interface AiChatRequest {
    conversationId?: string;
    userId: string;
    message: string;
    history: AiChatMessage[];
}

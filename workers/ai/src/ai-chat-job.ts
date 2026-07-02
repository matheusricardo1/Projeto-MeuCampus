import type { AiChatMessage } from '@/models/ai-chat-message';

export const AI_CHAT_QUEUE_NAME = process.env.AI_CHAT_QUEUE || 'ai-chat';
export const AI_CHAT_RESULT_CHANNEL = process.env.AI_CHAT_RESULT_CHANNEL || 'ai:chat:result';

export interface AiChatJobData {
    conversationId?: string;
    userId: string;
    message: string;
    history: AiChatMessage[];
}

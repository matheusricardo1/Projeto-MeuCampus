import type { AiChatMessage } from '@ai/domain/entities/ai-chat-message.entity';

export const AI_CHAT_RESULT_CHANNEL = process.env.AI_CHAT_RESULT_CHANNEL || 'ai:chat:result';

export interface AiChatReadyEvent {
    jobId: string;
    userId: string;
    reply: {
        conversationId: string;
        message: AiChatMessage;
    };
}

export interface AiChatFailedEvent {
    jobId: string;
    userId: string;
    status: 'failed';
    errorName: string;
    message: string;
}

export type AiChatResultEvent = AiChatReadyEvent | AiChatFailedEvent;

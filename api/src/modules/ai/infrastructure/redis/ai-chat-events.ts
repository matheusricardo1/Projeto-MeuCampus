import type { AiChatMessage } from '@ai/domain/entities/ai-chat-message.entity';

export const AI_CHAT_RESULT_CHANNEL = process.env.AI_CHAT_RESULT_CHANNEL || 'ai:chat:result';

export interface AiChatChunkEvent {
    type: 'chunk';
    jobId: string;
    userId: string;
    delta: string;
}

export interface AiChatToolEvent {
    type: 'tool';
    jobId: string;
    userId: string;
    toolName: string;
}

export interface AiChatReadyEvent {
    type: 'ready';
    jobId: string;
    userId: string;
    reply: {
        conversationId: string;
        message: AiChatMessage;
    };
}

export interface AiChatFailedEvent {
    type: 'failed';
    jobId: string;
    userId: string;
    errorName: string;
    message: string;
}

export type AiChatResultEvent = AiChatChunkEvent | AiChatToolEvent | AiChatReadyEvent | AiChatFailedEvent;

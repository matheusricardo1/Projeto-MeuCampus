import type { AiChatMessage } from '@ai/domain/entities/ai-chat-message.entity';

export const AI_CHAT_RESULT_CHANNEL = process.env.AI_CHAT_RESULT_CHANNEL || 'ai:chat:result';

interface AiChatUsage {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
}

interface AiChatToolEvent {
    type: 'tool';
    jobId: string;
    userId: string;
    toolName: string;
}

interface AiChatReadyEvent {
    type: 'ready';
    jobId: string;
    userId: string;
    reply: {
        conversationId: string;
        message: AiChatMessage;
        usage?: AiChatUsage | null;
    };
}

interface AiChatFailedEvent {
    type: 'failed';
    jobId: string;
    userId: string;
    errorName: string;
    message: string;
}

export type AiChatResultEvent = AiChatToolEvent | AiChatReadyEvent | AiChatFailedEvent;

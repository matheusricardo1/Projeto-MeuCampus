import type { AiChatReply } from '@/domain/value-objects/ai-chat-reply';

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
    reply: AiChatReply;
}

export interface AiChatFailedEvent {
    type: 'failed';
    jobId: string;
    userId: string;
    errorName: string;
    message: string;
}

export interface AiChatEventPublisher {
    publishTool(event: AiChatToolEvent): Promise<void>;
    publishReady(event: AiChatReadyEvent): Promise<void>;
    publishFailed(event: AiChatFailedEvent): Promise<void>;
}

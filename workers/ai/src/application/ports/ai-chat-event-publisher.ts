import type { AiChatReply } from '@/domain/value-objects/ai-chat-reply';

export interface AiChatChunkEvent {
    type: 'chunk';
    jobId: string;
    userId: string;
    delta: string;
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
    publishChunk(event: AiChatChunkEvent): Promise<void>;
    publishReady(event: AiChatReadyEvent): Promise<void>;
    publishFailed(event: AiChatFailedEvent): Promise<void>;
}

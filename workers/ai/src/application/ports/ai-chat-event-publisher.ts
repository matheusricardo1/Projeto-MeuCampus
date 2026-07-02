import type { AiChatReply } from '@/models/ai-chat-reply';

export interface AiChatReadyEvent {
    jobId: string;
    userId: string;
    reply: AiChatReply;
}

export interface AiChatFailedEvent {
    jobId: string;
    userId: string;
    status: 'failed';
    errorName: string;
    message: string;
}

export interface AiChatEventPublisher {
    publishReady(event: AiChatReadyEvent): Promise<void>;
    publishFailed(event: AiChatFailedEvent): Promise<void>;
}

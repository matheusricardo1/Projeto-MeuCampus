export const AI_CHAT_REPLY_EVENT = 'ecampus:ai-reply';
export const AI_CHAT_FAILED_EVENT = 'ecampus:ai-failed';

export interface AiChatReplyNotification {
    userId: string;
    jobId: string;
    conversationId: string;
    message: { id: string; role: string; content: string; createdAt: string };
}

export interface AiChatFailedNotification {
    userId: string;
    jobId: string;
    message: string;
}

export abstract class AiNotificationService {
    abstract emitChatReply(event: AiChatReplyNotification): void;
    abstract emitChatFailed(event: AiChatFailedNotification): void;
}

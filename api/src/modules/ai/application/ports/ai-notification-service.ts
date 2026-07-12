export const AI_CHAT_REPLY_EVENT = 'ecampus:ai-reply';
export const AI_CHAT_FAILED_EVENT = 'ecampus:ai-failed';
export const AI_CHAT_CHUNK_EVENT = 'ecampus:ai-chunk';
export const AI_CHAT_TOOL_EVENT = 'ecampus:ai-tool';

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

export interface AiChatChunkNotification {
    userId: string;
    jobId: string;
    delta: string;
}

export interface AiChatToolNotification {
    userId: string;
    jobId: string;
    toolName: string;
}

export abstract class AiNotificationService {
    abstract emitChatReply(event: AiChatReplyNotification): void;
    abstract emitChatFailed(event: AiChatFailedNotification): void;
    abstract emitChatChunk(event: AiChatChunkNotification): void;
    abstract emitChatTool(event: AiChatToolNotification): void;
}

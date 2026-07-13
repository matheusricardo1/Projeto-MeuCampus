import type { AiChatMessage } from '@/domain/entities/ai-chat-message';

export interface AiChatUsage {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
}

export interface AiChatReply {
    conversationId: string;
    message: AiChatMessage;
    /** Absent for the mock provider, or when the real provider failed/aborted before usage was reported. */
    usage?: AiChatUsage | null;
}

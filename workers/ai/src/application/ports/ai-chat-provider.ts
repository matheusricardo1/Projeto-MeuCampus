import type { AiChatReply } from '@/domain/value-objects/ai-chat-reply';
import type { AiChatRequest } from '@/domain/value-objects/ai-chat-request';

export interface AiChatStreamHandlers {
    onToolCall?: (toolName: string) => void;
    signal: AbortSignal;
}

export interface AiChatProvider {
    generateReply(request: AiChatRequest, handlers: AiChatStreamHandlers): Promise<AiChatReply>;
    getProviderInfo(): Record<string, unknown>;
}

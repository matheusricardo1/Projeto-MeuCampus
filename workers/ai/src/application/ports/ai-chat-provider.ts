import type { AiChatReply } from '@/domain/value-objects/ai-chat-reply';
import type { AiChatRequest } from '@/domain/value-objects/ai-chat-request';

export interface AiChatProvider {
    generateReply(request: AiChatRequest): Promise<AiChatReply>;
    getProviderInfo(): Record<string, unknown>;
}

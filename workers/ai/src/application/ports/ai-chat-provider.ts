import type { AiChatReply } from '@/models/ai-chat-reply';
import type { AiChatRequest } from '@/models/ai-chat-request';

export interface AiChatProvider {
    generateReply(request: AiChatRequest): Promise<AiChatReply>;
    getProviderInfo(): Record<string, unknown>;
}

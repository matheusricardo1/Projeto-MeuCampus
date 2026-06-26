import type { AiChatReply } from '@ai/domain/models/ai-chat-reply';
import type { AiChatRequest } from '@ai/domain/models/ai-chat-request';

export interface AiChatProvider {
    generateReply(request: AiChatRequest): Promise<AiChatReply>;
}

export const AI_CHAT_PROVIDER = Symbol('AI_CHAT_PROVIDER');

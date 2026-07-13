import { randomUUID } from 'node:crypto';
import type { AiChatReply } from '@/domain/value-objects/ai-chat-reply';
import type { AiChatRequest } from '@/domain/value-objects/ai-chat-request';
import type { AiChatProvider, AiChatStreamHandlers } from '@/application/ports/ai-chat-provider';

export class MockAiChatProvider implements AiChatProvider {
    async generateReply(request: AiChatRequest, _handlers: AiChatStreamHandlers): Promise<AiChatReply> {
        const conversationId = request.conversationId?.trim() || randomUUID();
        const content = `Ainda estou em modo mock, mas ja recebi sua pergunta academica: "${request.message}".`;

        return {
            conversationId,
            message: {
                id: randomUUID(),
                role: 'assistant',
                content,
                createdAt: new Date().toISOString()
            }
        };
    }

    getProviderInfo(): Record<string, unknown> {
        return {
            provider: 'mock'
        };
    }
}

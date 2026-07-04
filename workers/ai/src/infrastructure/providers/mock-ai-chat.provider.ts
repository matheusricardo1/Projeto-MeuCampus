import { randomUUID } from 'node:crypto';
import type { AiChatReply } from '@/domain/value-objects/ai-chat-reply';
import type { AiChatRequest } from '@/domain/value-objects/ai-chat-request';
import type { AiChatProvider } from '@/application/ports/ai-chat-provider';

export class MockAiChatProvider implements AiChatProvider {
    async generateReply(request: AiChatRequest): Promise<AiChatReply> {
        const conversationId = request.conversationId?.trim() || randomUUID();

        return {
            conversationId,
            message: {
                id: randomUUID(),
                role: 'assistant',
                content: `Ainda estou em modo mock, mas ja recebi sua pergunta academica: "${request.message}".`,
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

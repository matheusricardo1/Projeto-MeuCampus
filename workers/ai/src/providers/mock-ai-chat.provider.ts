import { randomUUID } from 'node:crypto';
import type { AiChatReply } from '@/models/ai-chat-reply';
import type { AiChatRequest } from '@/models/ai-chat-request';

export class MockAiChatProvider {
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
}

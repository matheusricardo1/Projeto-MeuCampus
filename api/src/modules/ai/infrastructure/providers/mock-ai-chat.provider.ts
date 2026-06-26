import { randomUUID } from 'node:crypto';
import type { AiChatProvider } from '@ai/application/ports/ai-chat-provider';
import type { AiChatReply } from '@ai/domain/models/ai-chat-reply';
import type { AiChatRequest } from '@ai/domain/models/ai-chat-request';

export class MockAiChatProvider implements AiChatProvider {
    async generateReply(request: AiChatRequest): Promise<AiChatReply> {
        const conversationId = request.conversationId?.trim() || randomUUID();

        return {
            conversationId,
            message: {
                id: randomUUID(),
                role: 'assistant',
                content: this.buildReply(request.message),
                createdAt: new Date().toISOString()
            }
        };
    }

    private buildReply(message: string): string {
        return `Ainda estou em modo mock, mas ja recebi sua pergunta sobre "${message}". Quando a IA real estiver conectada, eu vou responder usando seus dados academicos.`;
    }
}

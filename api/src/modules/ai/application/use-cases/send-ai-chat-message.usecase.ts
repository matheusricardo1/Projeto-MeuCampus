import { randomUUID } from 'node:crypto';
import { InvalidAiMessageError } from '@ai/domain/errors/invalid-ai-message.error';
import type { AiChatMessage } from '@ai/domain/models/ai-chat-message';
import type { AiChatReply } from '@ai/domain/models/ai-chat-reply';
import type { AiChatProvider } from '@ai/application/ports/ai-chat-provider';

export interface SendAiChatMessageInput {
    conversationId?: string;
    message: string;
    history?: AiChatMessage[];
}

export class SendAiChatMessageUseCase {
    constructor(private readonly aiChatProvider: AiChatProvider) {}

    async execute(userId: string, input: SendAiChatMessageInput): Promise<AiChatReply> {
        const message = this.parseMessage(input.message);
        const history = this.parseHistory(input.history);
        const request = {
            userId,
            message,
            history,
            ...(input.conversationId ? { conversationId: input.conversationId } : {})
        };

        return this.aiChatProvider.generateReply(request);
    }

    private parseMessage(value: string): string {
        const message = value?.trim();
        if (!message || message.length > 4000) {
            throw new InvalidAiMessageError('Informe uma mensagem entre 1 e 4000 caracteres.');
        }

        return message;
    }

    private parseHistory(value?: AiChatMessage[]): AiChatMessage[] {
        if (!value) return [];
        if (!Array.isArray(value)) return [];

        return value
            .filter((message) => {
                return message
                    && ['user', 'assistant', 'system'].includes(message.role)
                    && typeof message.content === 'string'
                    && message.content.trim().length > 0;
            })
            .slice(-20)
            .map((message) => ({
                id: String(message.id || randomUUID()),
                role: message.role,
                content: message.content.trim().slice(0, 4000),
                createdAt: typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString()
            }));
    }
}

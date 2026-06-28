import type { AiChatMessage } from '@ai/domain/entities/ai-chat-message.entity';
import type { SendAiChatMessageInput } from '@ai/application/use-cases/send-ai-chat-message.usecase';

export class SendAiChatMessageRequest {
    constructor(
        public readonly conversationId?: string,
        public readonly message?: string,
        public readonly history?: AiChatMessage[]
    ) {}

    toUseCaseInput(): SendAiChatMessageInput {
        return {
            message: this.message || '',
            ...(this.conversationId ? { conversationId: this.conversationId } : {}),
            ...(this.history ? { history: this.history } : {})
        };
    }
}

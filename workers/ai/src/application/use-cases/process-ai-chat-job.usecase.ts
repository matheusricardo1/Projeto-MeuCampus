import type { AiChatProvider } from '@/application/ports/ai-chat-provider';
import type { AiChatJobData } from '@/ai-chat-job';
import type { AiChatReply } from '@/models/ai-chat-reply';

export class ProcessAiChatJobUseCase {
    constructor(private readonly provider: AiChatProvider) {}

    execute(data: AiChatJobData): Promise<AiChatReply> {
        return this.provider.generateReply(data);
    }

    getProviderInfo(): Record<string, unknown> {
        return this.provider.getProviderInfo();
    }
}

import type { AiChatProvider } from '@/application/ports/ai-chat-provider';
import type { AiChatEventPublisher } from '@/application/ports/ai-chat-event-publisher';
import type { AiChatJobData } from '@/ai-chat-job';
import type { AiChatReply } from '@/models/ai-chat-reply';

export class ProcessAiChatJobUseCase {
    constructor(
        private readonly provider: AiChatProvider,
        private readonly events: AiChatEventPublisher
    ) {}

    async execute(data: AiChatJobData, jobId: string): Promise<AiChatReply> {
        try {
            const reply = await this.provider.generateReply(data);
            await this.events.publishReady({ jobId, userId: data.userId, reply });
            return reply;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            await this.events.publishFailed({
                jobId,
                userId: data.userId,
                status: 'failed',
                errorName: err.name,
                message: err.message
            }).catch(() => undefined);
            throw error;
        }
    }

    getProviderInfo(): Record<string, unknown> {
        return this.provider.getProviderInfo();
    }
}

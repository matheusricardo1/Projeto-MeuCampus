import type { AiChatProvider } from '@/application/ports/ai-chat-provider';
import type { AiChatEventPublisher } from '@/application/ports/ai-chat-event-publisher';
import type { AiChatJobData } from '@/application/ports/ai-chat-job';
import type { AiChatReply } from '@/domain/value-objects/ai-chat-reply';
import type { AiChatCancellationRegistry } from '@/infrastructure/cancellation/ai-chat-cancellation-registry';

export class ProcessAiChatJobUseCase {
    constructor(
        private readonly provider: AiChatProvider,
        private readonly events: AiChatEventPublisher,
        private readonly registry: AiChatCancellationRegistry
    ) {}

    async execute(data: AiChatJobData, jobId: string): Promise<AiChatReply> {
        const controller = this.registry.create(jobId);

        try {
            const reply = await this.provider.generateReply(data, {
                signal: controller.signal,
                onToolCall: (toolName) => {
                    void this.events.publishTool({ type: 'tool', jobId, userId: data.userId, toolName });
                }
            });

            await this.events.publishReady({ type: 'ready', jobId, userId: data.userId, reply });
            return reply;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            await this.events.publishFailed({
                type: 'failed',
                jobId,
                userId: data.userId,
                errorName: err.name,
                message: err.message
            }).catch(() => undefined);
            throw error;
        } finally {
            this.registry.release(jobId);
        }
    }

    getProviderInfo(): Record<string, unknown> {
        return this.provider.getProviderInfo();
    }
}

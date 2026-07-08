import type { AiChatProvider } from '@/application/ports/ai-chat-provider';
import type { AiChatEventPublisher } from '@/application/ports/ai-chat-event-publisher';
import type { AiChatJobData } from '@/application/ports/ai-chat-job';
import type { AiChatReply } from '@/domain/value-objects/ai-chat-reply';
import type { AiChatCancellationRegistry } from '@/infrastructure/cancellation/ai-chat-cancellation-registry';

// Publishing one Redis/WebSocket message per token would flood both — deltas
// are buffered and flushed either once they reach this size or after this
// many idle milliseconds, whichever comes first, so the client still sees a
// smooth stream without a message-per-token storm.
const CHUNK_FLUSH_MIN_CHARS = 24;
const CHUNK_FLUSH_MAX_DELAY_MS = 80;

export class ProcessAiChatJobUseCase {
    constructor(
        private readonly provider: AiChatProvider,
        private readonly events: AiChatEventPublisher,
        private readonly registry: AiChatCancellationRegistry
    ) {}

    async execute(data: AiChatJobData, jobId: string): Promise<AiChatReply> {
        const controller = this.registry.create(jobId);
        let buffer = '';
        let flushTimer: ReturnType<typeof setTimeout> | null = null;

        const clearScheduledFlush = () => {
            if (!flushTimer) return;
            clearTimeout(flushTimer);
            flushTimer = null;
        };

        const flush = () => {
            clearScheduledFlush();
            if (!buffer) return;

            const delta = buffer;
            buffer = '';
            void this.events.publishChunk({ type: 'chunk', jobId, userId: data.userId, delta });
        };

        try {
            const reply = await this.provider.generateReply(data, {
                signal: controller.signal,
                onDelta: (delta) => {
                    buffer += delta;
                    if (buffer.length >= CHUNK_FLUSH_MIN_CHARS) {
                        flush();
                        return;
                    }

                    if (!flushTimer) {
                        flushTimer = setTimeout(flush, CHUNK_FLUSH_MAX_DELAY_MS);
                    }
                }
            });

            flush();
            await this.events.publishReady({ type: 'ready', jobId, userId: data.userId, reply });
            return reply;
        } catch (error) {
            flush();
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
            clearScheduledFlush();
            this.registry.release(jobId);
        }
    }

    getProviderInfo(): Record<string, unknown> {
        return this.provider.getProviderInfo();
    }
}

import Redis from 'ioredis';
import { createRedisConnectionOptions } from '@/infrastructure/redis/redis-connection';
import { AI_CHAT_CANCEL_CHANNEL } from '@/application/ports/ai-chat-job';
import type { AiChatCancellationRegistry } from '@/infrastructure/cancellation/ai-chat-cancellation-registry';
import { appLogger } from '@/infrastructure/logging/app-logger';

export class RedisAiChatCancelSubscriber {
    private readonly subscriber = new Redis(createRedisConnectionOptions());

    constructor(private readonly registry: AiChatCancellationRegistry) {}

    async start(): Promise<void> {
        this.subscriber.on('message', (_channel, message) => {
            this.handleMessage(message);
        });
        this.subscriber.on('error', (error) => {
            appLogger.error('Redis Pub/Sub error in AI chat cancel subscriber.', {
                errorName: error.name,
                message: error.message
            });
        });

        await this.subscriber.subscribe(AI_CHAT_CANCEL_CHANNEL);
        appLogger.info('Subscribed to AI chat cancel requests.', { channel: AI_CHAT_CANCEL_CHANNEL });
    }

    async close(): Promise<void> {
        await this.subscriber.quit();
    }

    private handleMessage(message: string): void {
        let jobId: string | undefined;

        try {
            const parsed = JSON.parse(message) as { jobId?: string };
            jobId = parsed.jobId;
        } catch {
            return;
        }

        if (!jobId) return;

        const aborted = this.registry.abort(jobId);
        appLogger.info('Processed AI chat cancel request.', { jobId, aborted });
    }
}

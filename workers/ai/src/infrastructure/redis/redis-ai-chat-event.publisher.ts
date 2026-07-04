import Redis from 'ioredis';
import { createRedisConnectionOptions } from '@/infrastructure/redis/redis-connection';
import { AI_CHAT_RESULT_CHANNEL } from '@/application/ports/ai-chat-job';
import type { AiChatEventPublisher, AiChatFailedEvent, AiChatReadyEvent } from '@/application/ports/ai-chat-event-publisher';

export class RedisAiChatEventPublisher implements AiChatEventPublisher {
    private readonly publisher = new Redis(createRedisConnectionOptions());

    async publishReady(event: AiChatReadyEvent): Promise<void> {
        await this.publisher.publish(AI_CHAT_RESULT_CHANNEL, JSON.stringify(event));
    }

    async publishFailed(event: AiChatFailedEvent): Promise<void> {
        await this.publisher.publish(AI_CHAT_RESULT_CHANNEL, JSON.stringify(event));
    }

    async close(): Promise<void> {
        await this.publisher.quit();
    }
}

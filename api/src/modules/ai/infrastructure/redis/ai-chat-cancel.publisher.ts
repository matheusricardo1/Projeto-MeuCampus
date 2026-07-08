import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { createApiRedisConnectionOptions } from '@/shared/redis-connection';
import { AI_CHAT_CANCEL_CHANNEL } from '@ai/infrastructure/queue/ai-chat-job';

@Injectable()
export class AiChatCancelPublisher implements OnModuleDestroy {
    private readonly publisher = new Redis(createApiRedisConnectionOptions());

    async publish(jobId: string): Promise<void> {
        await this.publisher.publish(AI_CHAT_CANCEL_CHANNEL, JSON.stringify({ jobId }));
    }

    async onModuleDestroy(): Promise<void> {
        await this.publisher.quit();
    }
}

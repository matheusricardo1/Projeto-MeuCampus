import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { AiNotificationService } from '@ai/application/ports/ai-notification-service';
import { AiUsageRepository } from '@billing/infrastructure/prisma/ai-usage.repository';
import { appLogger } from '@/shared/logging/app-logger';
import {
    AI_CHAT_RESULT_CHANNEL,
    type AiChatResultEvent
} from '@ai/infrastructure/redis/ai-chat-events';

@Injectable()
export class AiChatEventsSubscriber implements OnModuleInit, OnModuleDestroy {
    private readonly subscriber = new Redis(createRedisConnectionOptions());

    constructor(
        private readonly notifier: AiNotificationService,
        private readonly aiUsageRepository: AiUsageRepository
    ) {}

    async onModuleInit(): Promise<void> {
        this.subscriber.on('message', (_channel, message) => {
            void this.handleMessage(message);
        });
        this.subscriber.on('error', (error) => {
            appLogger.error('Redis Pub/Sub error in AI chat subscriber.', {
                errorName: error.name,
                message: error.message
            });
        });
        await this.subscriber.subscribe(AI_CHAT_RESULT_CHANNEL);
        appLogger.info('Subscribed to AI chat result notifications.', { channel: AI_CHAT_RESULT_CHANNEL });
    }

    async onModuleDestroy(): Promise<void> {
        await this.subscriber.quit();
    }

    private async handleMessage(message: string): Promise<void> {
        let event: AiChatResultEvent;

        try {
            event = JSON.parse(message) as AiChatResultEvent;
            if (!event.jobId || !event.userId) {
                throw new Error('Invalid AI chat result event.');
            }
        } catch (error) {
            appLogger.warning('Ignored invalid AI chat result notification.', {
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
            return;
        }

        if (event.type === 'tool') {
            this.notifier.emitChatTool({ userId: event.userId, jobId: event.jobId, toolName: event.toolName });
            return;
        }

        if (event.type === 'failed') {
            this.notifier.emitChatFailed({ userId: event.userId, jobId: event.jobId, message: event.message });
            return;
        }

        this.notifier.emitChatReply({
            userId: event.userId,
            jobId: event.jobId,
            conversationId: event.reply.conversationId,
            message: event.reply.message
        });

        if (event.reply.usage) {
            this.aiUsageRepository.record({
                userId: event.userId,
                jobId: event.jobId,
                ...event.reply.usage
            }).catch((error: unknown) => {
                appLogger.error('Failed to persist AI token usage.', {
                    jobId: event.jobId,
                    errorName: error instanceof Error ? error.name : 'UnknownError',
                    message: error instanceof Error ? error.message : String(error)
                });
            });
        }
    }
}

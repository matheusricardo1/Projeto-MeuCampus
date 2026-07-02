import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { AcademicNotificationService } from '@realtime/application/ports/academic-notification-service';
import { appLogger } from '@/shared/logging/app-logger';
import {
    AI_CHAT_RESULT_CHANNEL,
    type AiChatFailedEvent,
    type AiChatReadyEvent,
    type AiChatResultEvent
} from '@ai/infrastructure/redis/ai-chat-events';

@Injectable()
export class AiChatEventsSubscriber implements OnModuleInit, OnModuleDestroy {
    private readonly subscriber = new Redis(createRedisConnectionOptions());

    constructor(private readonly notifier: AcademicNotificationService) {}

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

        if (this.isFailedEvent(event)) {
            this.notifier.emitAiChatFailed({ userId: event.userId, jobId: event.jobId, message: event.message });
            return;
        }

        const ready = event as AiChatReadyEvent;
        this.notifier.emitAiChatReply({
            userId: ready.userId,
            jobId: ready.jobId,
            conversationId: ready.reply.conversationId,
            message: ready.reply.message as { id: string; role: string; content: string; createdAt: string }
        });
    }

    private isFailedEvent(event: AiChatResultEvent): event is AiChatFailedEvent {
        return 'status' in event && (event as AiChatFailedEvent).status === 'failed';
    }
}

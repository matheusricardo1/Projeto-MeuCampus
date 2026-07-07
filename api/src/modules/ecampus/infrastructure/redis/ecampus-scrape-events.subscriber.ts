import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AcademicNotificationService } from '@academic/application/ports/academic-notification-service';
import { HandleAcademicLoginReadyUseCase } from '@academic/application/use-cases/handle-academic-login-ready.usecase';
import { HandleAcademicResourceFailedUseCase } from '@academic/application/use-cases/handle-academic-resource-failed.usecase';
import { HandleAcademicResourceReadyUseCase } from '@academic/application/use-cases/handle-academic-resource-ready.usecase';
import { logger } from '@ecampus/infrastructure/logging/console-logger';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { decryptQueuePayload } from '@/shared/security/ecampus-queue-payload-cipher';
import {
    ACADEMIC_SCRAPE_RESULT_CHANNEL,
    type AcademicLoginFailedEvent,
    type AcademicLoginReadyEvent,
    type AcademicResourceFailedEvent,
    type AcademicResourceReadyEvent,
    type AcademicScrapeResultEvent
} from '@ecampus/infrastructure/redis/ecampus-scrape-events';

/**
 * Redis Pub/Sub adapter only: subscription lifecycle, message parsing/
 * decryption, and routing to the use case for each event type. No session,
 * bootstrap, or notification logic lives here anymore.
 */
@Injectable()
export class EcampusScrapeEventsSubscriber implements OnModuleInit, OnModuleDestroy {
    private readonly subscriber = new Redis(createRedisConnectionOptions());

    constructor(
        private readonly notifier: AcademicNotificationService,
        private readonly handleLoginReady: HandleAcademicLoginReadyUseCase,
        private readonly handleResourceFailed: HandleAcademicResourceFailedUseCase,
        private readonly handleResourceReady: HandleAcademicResourceReadyUseCase
    ) {}

    async onModuleInit(): Promise<void> {
        this.subscriber.on('message', (_channel, message) => {
            void this.handleMessage(message);
        });
        this.subscriber.on('error', (error) => {
            logger.error('Redis Pub/Sub connection error for eCampus scrape notifications.', {
                errorName: error.name,
                message: error.message
            });
        });
        this.subscriber.on('reconnecting', (delay: number) => {
            logger.warning('Redis Pub/Sub subscriber reconnecting — scrape events published during this gap will be lost.', {
                delayMs: delay,
                channel: ACADEMIC_SCRAPE_RESULT_CHANNEL
            });
        });
        this.subscriber.on('ready', () => {
            logger.info('Redis Pub/Sub subscriber reconnected and re-subscribed.', {
                channel: ACADEMIC_SCRAPE_RESULT_CHANNEL
            });
        });
        await this.subscriber.subscribe(ACADEMIC_SCRAPE_RESULT_CHANNEL);
        logger.info('Subscribed to eCampus scrape notifications.', {
            channel: ACADEMIC_SCRAPE_RESULT_CHANNEL
        });
    }

    async onModuleDestroy(): Promise<void> {
        await this.subscriber.quit();
        logger.info('Stopped eCampus scrape notification subscriber.', {
            channel: ACADEMIC_SCRAPE_RESULT_CHANNEL
        });
    }

    private async handleMessage(message: string): Promise<void> {
        let event: AcademicScrapeResultEvent;

        try {
            event = JSON.parse(message) as AcademicScrapeResultEvent;
            if (!event.cpf) {
                throw new Error('Invalid eCampus scrape event.');
            }
            if (this.isLoginReadyEvent(event)) {
                event = { ...event, session: decryptQueuePayload<Record<string, unknown>>(event.session as unknown as string) };
            }
        } catch (error) {
            logger.warning('Ignored invalid eCampus scrape notification.', {
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
            return;
        }

        logger.info('Received eCampus scrape notification from Redis.', {
            channel: ACADEMIC_SCRAPE_RESULT_CHANNEL,
            type: 'type' in event ? event.type : 'resource',
            status: 'status' in event ? event.status : 'ready'
        });

        try {
            if (this.isLoginEvent(event)) {
                await this.routeLoginEvent(event);
                return;
            }

            if (this.isResourceFailedEvent(event)) {
                await this.handleResourceFailed.execute(event);
                return;
            }

            await this.handleResourceReady.execute(event);
        } catch (error) {
            logger.error('Failed to send eCampus scrape notification through WebSocket.', {
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private isLoginEvent(event: AcademicScrapeResultEvent): event is AcademicLoginReadyEvent | AcademicLoginFailedEvent {
        return 'type' in event && (event as AcademicLoginReadyEvent).type === 'login';
    }

    private isLoginReadyEvent(event: AcademicScrapeResultEvent): event is AcademicLoginReadyEvent {
        return this.isLoginEvent(event) && !('status' in event);
    }

    private isResourceFailedEvent(event: AcademicResourceReadyEvent | AcademicResourceFailedEvent): event is AcademicResourceFailedEvent {
        return 'status' in event && (event as AcademicResourceFailedEvent).status === 'failed';
    }

    private async routeLoginEvent(event: AcademicLoginReadyEvent | AcademicLoginFailedEvent): Promise<void> {
        if ('status' in event && event.status === 'failed') {
            this.notifier.emitLoginFailed({ jobId: event.jobId, message: (event as AcademicLoginFailedEvent).message });
            return;
        }

        const ready = event as AcademicLoginReadyEvent;
        await this.handleLoginReady.execute(ready);
    }
}

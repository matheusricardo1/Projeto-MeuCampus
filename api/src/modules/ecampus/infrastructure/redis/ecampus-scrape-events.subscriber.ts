import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AcademicNotificationService } from '@realtime/application/ports/academic-notification-service';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { logger } from '@ecampus/infrastructure/logging/console-logger';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import {
    ACADEMIC_SCRAPE_RESULT_CHANNEL,
    type AcademicResourceFailedEvent,
    type AcademicScrapeResultEvent
} from '@ecampus/infrastructure/redis/ecampus-scrape-events';

@Injectable()
export class EcampusScrapeEventsSubscriber implements OnModuleInit, OnModuleDestroy {
    private readonly subscriber = new Redis(createRedisConnectionOptions());

    constructor(
        private readonly notifier: AcademicNotificationService,
        private readonly academicDataRepository: AcademicDataRepository,
        private readonly sessionRegistry: AcademicSessionRegistry
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
            if (!event.cpf || !event.resource) {
                throw new Error('Invalid eCampus scrape event.');
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
            resource: event.resource,
            year: event.year,
            period: event.period,
            planId: event.planId,
            status: 'status' in event ? event.status : 'ready'
        });

        try {
            if (this.isFailedEvent(event)) {
                if (event.errorName === 'AuthenticationError') {
                    await this.invalidateExpiredSession(event.cpf);
                }

                this.notifier.emitResourceFailed(event);
                return;
            }

            this.notifier.emitResourceReady(event);
        } catch (error) {
            logger.error('Failed to send eCampus scrape notification through WebSocket.', {
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error),
                resource: event.resource,
                year: event.year,
                period: event.period,
                planId: event.planId
            });
        }
    }

    private isFailedEvent(event: AcademicScrapeResultEvent): event is AcademicResourceFailedEvent {
        return 'status' in event && event.status === 'failed';
    }

    private async invalidateExpiredSession(cpf: string): Promise<void> {
        const [cacheDeletedKeys] = await Promise.all([
            this.academicDataRepository.clearUserCache(cpf),
            this.sessionRegistry.invalidate(cpf)
        ]);

        logger.warning('Invalidated academic session after worker authentication failure.', {
            cacheDeletedKeys
        });
    }
}

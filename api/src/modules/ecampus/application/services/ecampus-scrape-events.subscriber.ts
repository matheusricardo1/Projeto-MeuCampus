import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { EcampusGateway } from '@ecampus/presentation/ws/ecampus.gateway';
import { logger } from '@ecampus/infrastructure/logging/console-logger';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import {
    ECAMPUS_SCRAPE_RESULT_CHANNEL,
    type EcampusResourceFailedEvent,
    type EcampusScrapeResultEvent
} from '@/shared/ecampus-scrape-events';

@Injectable()
export class EcampusScrapeEventsSubscriber implements OnModuleInit, OnModuleDestroy {
    private readonly subscriber = new Redis(createRedisConnectionOptions());

    constructor(private readonly gateway: EcampusGateway) {}

    async onModuleInit(): Promise<void> {
        this.subscriber.on('message', (_channel, message) => this.handleMessage(message));
        this.subscriber.on('error', (error) => {
            logger.error('Redis Pub/Sub connection error for eCampus scrape notifications.', {
                errorName: error.name,
                message: error.message
            });
        });
        await this.subscriber.subscribe(ECAMPUS_SCRAPE_RESULT_CHANNEL);
        logger.info('Subscribed to eCampus scrape notifications.', {
            channel: ECAMPUS_SCRAPE_RESULT_CHANNEL
        });
    }

    async onModuleDestroy(): Promise<void> {
        await this.subscriber.quit();
        logger.info('Stopped eCampus scrape notification subscriber.', {
            channel: ECAMPUS_SCRAPE_RESULT_CHANNEL
        });
    }

    private handleMessage(message: string): void {
        let event: EcampusScrapeResultEvent;

        try {
            event = JSON.parse(message) as EcampusScrapeResultEvent;
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
            channel: ECAMPUS_SCRAPE_RESULT_CHANNEL,
            resource: event.resource,
            year: event.year,
            period: event.period,
            planId: event.planId,
            status: 'status' in event ? event.status : 'ready'
        });

        try {
            if (this.isFailedEvent(event)) {
                this.gateway.emitResourceFailed(event);
                return;
            }

            this.gateway.emitResourceReady(event);
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

    private isFailedEvent(event: EcampusScrapeResultEvent): event is EcampusResourceFailedEvent {
        return 'status' in event && event.status === 'failed';
    }
}

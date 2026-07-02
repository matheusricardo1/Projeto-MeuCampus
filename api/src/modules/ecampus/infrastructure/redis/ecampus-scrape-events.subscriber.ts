import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AcademicNotificationService } from '@realtime/application/ports/academic-notification-service';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicBootstrapTracker, type AcademicBootstrapState } from '@academic/application/ports/academic-bootstrap-tracker';
import { PrefetchAcademicDataUseCase } from '@academic/application/use-cases/prefetch-academic-data.usecase';
import { logger } from '@ecampus/infrastructure/logging/console-logger';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import {
    ACADEMIC_SCRAPE_RESULT_CHANNEL,
    type AcademicLoginFailedEvent,
    type AcademicLoginReadyEvent,
    type AcademicResourceFailedEvent,
    type AcademicScrapeResultEvent
} from '@ecampus/infrastructure/redis/ecampus-scrape-events';

@Injectable()
export class EcampusScrapeEventsSubscriber implements OnModuleInit, OnModuleDestroy {
    private readonly subscriber = new Redis(createRedisConnectionOptions());

    constructor(
        private readonly notifier: AcademicNotificationService,
        private readonly academicDataRepository: AcademicDataRepository,
        private readonly sessionRegistry: AcademicSessionRegistry,
        private readonly bootstrapTracker: AcademicBootstrapTracker,
        private readonly accessTokenService: AccessTokenService,
        private readonly prefetchUseCase: PrefetchAcademicDataUseCase
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
        } catch (error) {
            logger.warning('Ignored invalid eCampus scrape notification.', {
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
            return;
        }

        const isLogin = this.isLoginEvent(event);
        logger.info('Received eCampus scrape notification from Redis.', {
            channel: ACADEMIC_SCRAPE_RESULT_CHANNEL,
            type: isLogin ? 'login' : 'resource',
            ...(!isLogin && { resource: (event as AcademicResourceFailedEvent).resource }),
            status: 'status' in event ? event.status : 'ready'
        });

        try {
            if (isLogin) {
                await this.handleLoginEvent(event);
                return;
            }

            const resourceEvent = event as AcademicResourceFailedEvent;

            if (this.isFailedEvent(resourceEvent)) {
                if (resourceEvent.errorName === 'AuthenticationError') {
                    await this.invalidateExpiredSession(resourceEvent.cpf);
                }

                const bootstrapState = await this.bootstrapTracker.markFailed(resourceEvent.cpf, resourceEvent.resource);
                if (bootstrapState?.status === 'failed') {
                    this.notifier.emitBootstrapFailed(this.toBootstrapNotification(bootstrapState));
                }

                this.notifier.emitResourceFailed(resourceEvent);
                return;
            }

            this.notifier.emitResourceReady(resourceEvent);
            const bootstrapState = await this.bootstrapTracker.markReady(resourceEvent.cpf, resourceEvent.resource);
            if (bootstrapState?.status === 'ready') {
                this.notifier.emitBootstrapReady(this.toBootstrapNotification(bootstrapState));
            }
        } catch (error) {
            logger.error('Failed to send eCampus scrape notification through WebSocket.', {
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private isLoginEvent(event: AcademicScrapeResultEvent): event is AcademicLoginReadyEvent | AcademicLoginFailedEvent {
        return 'type' in event && event.type === 'login';
    }

    private isFailedEvent(event: AcademicResourceFailedEvent | AcademicLoginReadyEvent): event is AcademicResourceFailedEvent {
        return 'status' in event && (event as AcademicResourceFailedEvent).status === 'failed';
    }

    private async handleLoginEvent(event: AcademicLoginReadyEvent | AcademicLoginFailedEvent): Promise<void> {
        if ('status' in event && event.status === 'failed') {
            this.notifier.emitLoginFailed({ jobId: event.jobId, message: (event as AcademicLoginFailedEvent).message });
            return;
        }

        const ready = event as AcademicLoginReadyEvent;
        const credentials = { cpf: ready.cpf, session: ready.session };
        await this.sessionRegistry.activate(credentials);
        const accessToken = this.accessTokenService.sign(credentials);
        this.notifier.emitLoginReady({ jobId: ready.jobId, accessToken });
        void this.prefetchUseCase.execute(credentials).catch((error: unknown) => {
            logger.error('Failed to prefetch academic data after login.', {
                cpf: ready.cpf,
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
        });
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

    private toBootstrapNotification(state: AcademicBootstrapState) {
        return {
            cpf: state.cpf,
            requiredResources: state.requiredResources,
            readyResources: state.readyResources,
            failedResources: state.failedResources
        };
    }
}

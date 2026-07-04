import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { RealtimeModule } from '@realtime/realtime.module';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { AcademicBootstrapTracker } from '@academic/application/ports/academic-bootstrap-tracker';
import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { AcademicNotificationService } from '@realtime/application/ports/academic-notification-service';
import { PrefetchAcademicDataUseCase } from '@academic/application/use-cases/prefetch-academic-data.usecase';
import { HandleAcademicLoginReadyUseCase } from '@academic/application/use-cases/handle-academic-login-ready.usecase';
import { HandleAcademicResourceFailedUseCase } from '@academic/application/use-cases/handle-academic-resource-failed.usecase';
import { HandleAcademicResourceReadyUseCase } from '@academic/application/use-cases/handle-academic-resource-ready.usecase';
import { EcampusScrapingJobService } from '@ecampus/infrastructure/queue/ecampus-job.service';
import { EcampusRedisRepository } from '@ecampus/infrastructure/redis/ecampus-redis.repository';
import { EcampusScrapeEventsSubscriber } from '@ecampus/infrastructure/redis/ecampus-scrape-events.subscriber';
import { EcampusBootstrapTracker } from '@ecampus/infrastructure/redis/ecampus-bootstrap-tracker';

@Module({
    imports: [AuthModule, RealtimeModule],
    providers: [
        EcampusScrapingJobService,
        EcampusRedisRepository,
        EcampusBootstrapTracker,
        {
            provide: PrefetchAcademicDataUseCase,
            useFactory: (jobs: ScrapingJobService, bootstrap: AcademicBootstrapTracker) =>
                new PrefetchAcademicDataUseCase(jobs, bootstrap),
            inject: [ScrapingJobService, AcademicBootstrapTracker]
        },
        {
            provide: HandleAcademicLoginReadyUseCase,
            useFactory: (
                sessions: AcademicSessionRegistry,
                tokens: AccessTokenService,
                notifier: AcademicNotificationService,
                prefetch: PrefetchAcademicDataUseCase
            ) => new HandleAcademicLoginReadyUseCase(sessions, tokens, notifier, prefetch),
            inject: [AcademicSessionRegistry, AccessTokenService, AcademicNotificationService, PrefetchAcademicDataUseCase]
        },
        {
            provide: HandleAcademicResourceFailedUseCase,
            useFactory: (
                repo: AcademicDataRepository,
                sessions: AcademicSessionRegistry,
                bootstrap: AcademicBootstrapTracker,
                notifier: AcademicNotificationService
            ) => new HandleAcademicResourceFailedUseCase(repo, sessions, bootstrap, notifier),
            inject: [AcademicDataRepository, AcademicSessionRegistry, AcademicBootstrapTracker, AcademicNotificationService]
        },
        {
            provide: HandleAcademicResourceReadyUseCase,
            useFactory: (bootstrap: AcademicBootstrapTracker, notifier: AcademicNotificationService) =>
                new HandleAcademicResourceReadyUseCase(bootstrap, notifier),
            inject: [AcademicBootstrapTracker, AcademicNotificationService]
        },
        {
            provide: EcampusScrapeEventsSubscriber,
            useFactory: (
                notifier: AcademicNotificationService,
                handleLoginReady: HandleAcademicLoginReadyUseCase,
                handleResourceFailed: HandleAcademicResourceFailedUseCase,
                handleResourceReady: HandleAcademicResourceReadyUseCase
            ) => new EcampusScrapeEventsSubscriber(notifier, handleLoginReady, handleResourceFailed, handleResourceReady),
            inject: [
                AcademicNotificationService,
                HandleAcademicLoginReadyUseCase,
                HandleAcademicResourceFailedUseCase,
                HandleAcademicResourceReadyUseCase
            ]
        },
        { provide: AcademicDataRepository, useExisting: EcampusRedisRepository },
        { provide: ScrapingJobService, useExisting: EcampusScrapingJobService },
        { provide: AcademicBootstrapTracker, useExisting: EcampusBootstrapTracker }
    ],
    exports: [
        AcademicDataRepository,
        ScrapingJobService,
        AcademicBootstrapTracker,
        PrefetchAcademicDataUseCase
    ]
})
export class EcampusModule {}

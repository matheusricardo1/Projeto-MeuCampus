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
            provide: EcampusScrapeEventsSubscriber,
            useFactory: (
                notifier: AcademicNotificationService,
                repo: AcademicDataRepository,
                sessions: AcademicSessionRegistry,
                bootstrap: AcademicBootstrapTracker,
                tokens: AccessTokenService,
                prefetch: PrefetchAcademicDataUseCase
            ) => new EcampusScrapeEventsSubscriber(notifier, repo, sessions, bootstrap, tokens, prefetch),
            inject: [
                AcademicNotificationService,
                AcademicDataRepository,
                AcademicSessionRegistry,
                AcademicBootstrapTracker,
                AccessTokenService,
                PrefetchAcademicDataUseCase
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

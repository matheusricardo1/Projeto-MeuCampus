import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { RealtimeModule } from '@realtime/realtime.module';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { EcampusScrapingJobService } from '@ecampus/infrastructure/queue/ecampus-job.service';
import { EcampusRedisRepository } from '@ecampus/infrastructure/redis/ecampus-redis.repository';
import { EcampusScrapeEventsSubscriber } from '@ecampus/infrastructure/redis/ecampus-scrape-events.subscriber';

@Module({
    imports: [AuthModule, RealtimeModule],
    providers: [
        EcampusScrapingJobService,
        EcampusRedisRepository,
        EcampusScrapeEventsSubscriber,
        { provide: AcademicDataRepository, useExisting: EcampusRedisRepository },
        { provide: ScrapingJobService, useExisting: EcampusScrapingJobService }
    ],
    exports: [
        AcademicDataRepository,
        ScrapingJobService
    ]
})
export class EcampusModule {}

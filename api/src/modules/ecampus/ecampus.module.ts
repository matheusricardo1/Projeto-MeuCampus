import { Module } from '@nestjs/common';
import { GetAcademicSubjectsUseCase } from '@academic/application/use-cases/get-academic-subjects.usecase';
import { GetGradesUseCase } from '@academic/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@academic/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@academic/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@academic/application/use-cases/get-schedule.usecase';
import { GetProfileUseCase } from '@academic/application/use-cases/get-profile.usecase';
import { LoginUseCase } from '@academic/application/use-cases/login.usecase';
import { LogoutAcademicSessionUseCase } from '@academic/application/use-cases/logout-academic-session.usecase';
import { JwtAccessTokenService } from '@ecampus/infrastructure/security/jwt-access-token-service';
import { AccessTokenService } from '@academic/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@academic/application/ports/academic-session-registry';
import { AcademicDataRepository } from '@/modules/academic/application/ports/academic-data-repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { EcampusRedisRepository } from '@/modules/ecampus/infrastructure/redis/ecampus-redis.repository';
import { EcampusSessionRegistry } from '@/modules/ecampus/infrastructure/redis/ecampus-session-registry';
import { EcampusScrapingJobService } from '@/modules/ecampus/infrastructure/queue/ecampus-job.service';
import { AcademicController } from '@academic/presentation/http/academic.controller';
import { AcademicJwtGuard } from '@academic/presentation/http/guards/academic-jwt.guard';
import { AcademicGateway } from '@academic/presentation/ws/academic.gateway';
import { EcampusScrapeEventsSubscriber } from '@ecampus/infrastructure/redis/ecampus-scrape-events.subscriber';

@Module({
  controllers: [AcademicController],
  providers: [
    JwtAccessTokenService,
    EcampusScrapingJobService,
    EcampusRedisRepository,
    EcampusSessionRegistry,
    AcademicJwtGuard,
    AcademicGateway,
    EcampusScrapeEventsSubscriber,
    // Ports mapping
    { provide: AccessTokenService, useExisting: JwtAccessTokenService },
    { provide: AcademicDataRepository, useExisting: EcampusRedisRepository },
    { provide: AcademicSessionRegistry, useExisting: EcampusSessionRegistry },
    { provide: ScrapingJobService, useExisting: EcampusScrapingJobService },
    // Use‑cases
    {
      provide: GetAcademicSubjectsUseCase,
      useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetAcademicSubjectsUseCase(cache, jobs),
      inject: [AcademicDataRepository, ScrapingJobService],
    },
    {
      provide: GetGradesUseCase,
      useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetGradesUseCase(cache, jobs),
      inject: [AcademicDataRepository, ScrapingJobService],
    },
    {
      provide: GetLessonPlanUseCase,
      useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetLessonPlanUseCase(cache, jobs),
      inject: [AcademicDataRepository, ScrapingJobService],
    },
    {
      provide: GetLessonPlanSubjectsUseCase,
      useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetLessonPlanSubjectsUseCase(cache, jobs),
      inject: [AcademicDataRepository, ScrapingJobService],
    },
    {
      provide: GetScheduleUseCase,
      useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetScheduleUseCase(cache, jobs),
      inject: [AcademicDataRepository, ScrapingJobService],
    },
    {
      provide: GetProfileUseCase,
      useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetProfileUseCase(cache, jobs),
      inject: [AcademicDataRepository, ScrapingJobService],
    },
    {
      provide: LoginUseCase,
      useFactory: (jobs: ScrapingJobService, tokens: AccessTokenService, sessions: AcademicSessionRegistry) => new LoginUseCase(jobs, tokens, sessions),
      inject: [ScrapingJobService, AccessTokenService, AcademicSessionRegistry],
    },
    {
      provide: LogoutAcademicSessionUseCase,
      useFactory: (jobs: ScrapingJobService, cache: AcademicDataRepository, sessions: AcademicSessionRegistry) => new LogoutAcademicSessionUseCase(jobs, cache, sessions),
      inject: [ScrapingJobService, AcademicDataRepository, AcademicSessionRegistry],
    },
  ],
})
export class EcampusModule {}

import { Module } from '@nestjs/common';
import { GetGradesUseCase } from '@ecampus/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@ecampus/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@ecampus/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@ecampus/application/use-cases/get-schedule.usecase';
import { GetProfileUseCase } from '@ecampus/application/use-cases/get-profile.usecase';
import { LoginUseCase } from '@ecampus/application/use-cases/login.usecase';
import { LogoutEcampusUseCase } from '@ecampus/application/use-cases/logout-ecampus.usecase';
import { EcampusAuthService } from '@ecampus/infrastructure/ecampus/ecampus-auth-service';
import { EcampusHttpRepository } from '@ecampus/infrastructure/ecampus/ecampus-http.repository';
import { JwtAccessTokenService } from '@ecampus/infrastructure/security/jwt-access-token-service';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import { EcampusRedisRepository } from '@/modules/ecampus/infrastructure/redis/ecampus-redis.repository';
import { EcampusJobService } from '@/modules/ecampus/application/services/ecampus-job.service';
import { EcampusController } from '@ecampus/presentation/http/ecampus.controller';
import { EcampusJwtGuard } from '@ecampus/presentation/http/guards/ecampus-jwt.guard';

@Module({
  controllers: [EcampusController],
  providers: [
    JwtAccessTokenService,
    EcampusJobService,
    EcampusRedisRepository,
    EcampusJwtGuard,
    // Ports mapping
    { provide: CacheRepository, useExisting: EcampusRedisRepository },
    { provide: JobService, useExisting: EcampusJobService },
    // Infra providers
    { provide: EcampusAuthService, useFactory: () => new EcampusAuthService() },
    {
      provide: EcampusHttpRepository,
      useFactory: (auth: EcampusAuthService) => new EcampusHttpRepository(auth),
      inject: [EcampusAuthService],
    },
    // Use‑cases
    {
      provide: GetGradesUseCase,
      useFactory: (cache: CacheRepository, jobs: JobService) => new GetGradesUseCase(cache, jobs),
      inject: [CacheRepository, JobService],
    },
    {
      provide: GetLessonPlanUseCase,
      useFactory: (cache: CacheRepository, jobs: JobService) => new GetLessonPlanUseCase(cache, jobs),
      inject: [CacheRepository, JobService],
    },
    {
      provide: GetLessonPlanSubjectsUseCase,
      useFactory: (cache: CacheRepository, jobs: JobService) => new GetLessonPlanSubjectsUseCase(cache, jobs),
      inject: [CacheRepository, JobService],
    },
    {
      provide: GetScheduleUseCase,
      useFactory: (cache: CacheRepository, jobs: JobService) => new GetScheduleUseCase(cache, jobs),
      inject: [CacheRepository, JobService],
    },
    {
      provide: GetProfileUseCase,
      useFactory: (cache: CacheRepository, jobs: JobService) => new GetProfileUseCase(cache, jobs),
      inject: [CacheRepository, JobService],
    },
    // Login already receives JobService via its constructor
    LoginUseCase,
    {
      provide: LogoutEcampusUseCase,
      useFactory: (repo: EcampusHttpRepository) => new LogoutEcampusUseCase(repo),
      inject: [EcampusHttpRepository],
    },
  ],
})
export class EcampusModule {}

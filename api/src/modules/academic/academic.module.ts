import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { EcampusModule } from '@ecampus/ecampus.module';
import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { AcademicAuthGuard } from '@auth/presentation/http/guards/academic-auth.guard';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { AcademicController } from '@academic/presentation/http/academic.controller';
import { GetAcademicSubjectsUseCase } from '@academic/application/use-cases/get-academic-subjects.usecase';
import { GetGradesUseCase } from '@academic/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@academic/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@academic/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@academic/application/use-cases/get-schedule.usecase';
import { GetProfileUseCase } from '@academic/application/use-cases/get-profile.usecase';
import { LoginUseCase } from '@academic/application/use-cases/login.usecase';
import { LogoutAcademicSessionUseCase } from '@academic/application/use-cases/logout-academic-session.usecase';
import { PrefetchAcademicDataUseCase } from '@academic/application/use-cases/prefetch-academic-data.usecase';
import { ValidateAcademicSessionUseCase } from '@academic/application/use-cases/validate-academic-session.usecase';

@Module({
    imports: [AuthModule, EcampusModule],
    controllers: [AcademicController],
    providers: [
        AcademicAuthGuard,
        {
            provide: GetAcademicSubjectsUseCase,
            useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetAcademicSubjectsUseCase(cache, jobs),
            inject: [AcademicDataRepository, ScrapingJobService]
        },
        {
            provide: GetGradesUseCase,
            useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetGradesUseCase(cache, jobs),
            inject: [AcademicDataRepository, ScrapingJobService]
        },
        {
            provide: GetLessonPlanUseCase,
            useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetLessonPlanUseCase(cache, jobs),
            inject: [AcademicDataRepository, ScrapingJobService]
        },
        {
            provide: GetLessonPlanSubjectsUseCase,
            useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetLessonPlanSubjectsUseCase(cache, jobs),
            inject: [AcademicDataRepository, ScrapingJobService]
        },
        {
            provide: GetScheduleUseCase,
            useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetScheduleUseCase(cache, jobs),
            inject: [AcademicDataRepository, ScrapingJobService]
        },
        {
            provide: GetProfileUseCase,
            useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new GetProfileUseCase(cache, jobs),
            inject: [AcademicDataRepository, ScrapingJobService]
        },
        {
            provide: LoginUseCase,
            useFactory: (
                jobs: ScrapingJobService,
                tokens: AccessTokenService,
                sessions: AcademicSessionRegistry,
                prefetch: PrefetchAcademicDataUseCase
            ) => new LoginUseCase(jobs, tokens, sessions, prefetch),
            inject: [ScrapingJobService, AccessTokenService, AcademicSessionRegistry, PrefetchAcademicDataUseCase]
        },
        {
            provide: PrefetchAcademicDataUseCase,
            useFactory: (jobs: ScrapingJobService) => new PrefetchAcademicDataUseCase(jobs),
            inject: [ScrapingJobService]
        },
        {
            provide: LogoutAcademicSessionUseCase,
            useFactory: (jobs: ScrapingJobService, cache: AcademicDataRepository, sessions: AcademicSessionRegistry) => new LogoutAcademicSessionUseCase(jobs, cache, sessions),
            inject: [ScrapingJobService, AcademicDataRepository, AcademicSessionRegistry]
        },
        {
            provide: ValidateAcademicSessionUseCase,
            useFactory: (cache: AcademicDataRepository, sessions: AcademicSessionRegistry) => new ValidateAcademicSessionUseCase(cache, sessions),
            inject: [AcademicDataRepository, AcademicSessionRegistry]
        }
    ]
})
export class AcademicModule {}

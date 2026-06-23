import { Module } from '@nestjs/common';
import { GetGradesUseCase } from '@ecampus/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@ecampus/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@ecampus/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@ecampus/application/use-cases/get-schedule.usecase';
import { GetStudentProfileUseCase } from '@ecampus/application/use-cases/get-student-profile.usecase';
import { LoginEcampusUseCase } from '@ecampus/application/use-cases/login-ecampus.usecase';
import { LogoutEcampusUseCase } from '@ecampus/application/use-cases/logout-ecampus.usecase';
import { EcampusAuthService } from '@ecampus/infrastructure/ecampus/ecampus-auth-service';
import { EcampusHttpRepository } from '@ecampus/infrastructure/ecampus/ecampus-http.repository';
import { JwtAccessTokenService } from '@ecampus/infrastructure/security/jwt-access-token-service';
import { MemorySessionStore } from '@ecampus/infrastructure/storage/memory-session-store';
import { EcampusController } from '@ecampus/presentation/http/ecampus.controller';
import { EcampusJwtGuard } from '@ecampus/presentation/http/guards/ecampus-jwt.guard';

@Module({
    controllers: [EcampusController],
    providers: [
        JwtAccessTokenService,
        MemorySessionStore,
        EcampusJwtGuard,
        {
            provide: EcampusAuthService,
            useFactory: (sessionStore: MemorySessionStore) => {
                return new EcampusAuthService(sessionStore);
            },
            inject: [MemorySessionStore]
        },
        {
            provide: EcampusHttpRepository,
            useFactory: (authService: EcampusAuthService) => {
                return new EcampusHttpRepository(authService);
            },
            inject: [EcampusAuthService]
        },
        {
            provide: GetGradesUseCase,
            useFactory: (ecampusRepository: EcampusHttpRepository) => {
                return new GetGradesUseCase(ecampusRepository);
            },
            inject: [EcampusHttpRepository]
        },
        {
            provide: GetLessonPlanUseCase,
            useFactory: (ecampusRepository: EcampusHttpRepository) => {
                return new GetLessonPlanUseCase(ecampusRepository);
            },
            inject: [EcampusHttpRepository]
        },
        {
            provide: GetLessonPlanSubjectsUseCase,
            useFactory: (ecampusRepository: EcampusHttpRepository) => {
                return new GetLessonPlanSubjectsUseCase(ecampusRepository);
            },
            inject: [EcampusHttpRepository]
        },
        {
            provide: GetScheduleUseCase,
            useFactory: (ecampusRepository: EcampusHttpRepository) => {
                return new GetScheduleUseCase(ecampusRepository);
            },
            inject: [EcampusHttpRepository]
        },
        {
            provide: GetStudentProfileUseCase,
            useFactory: (ecampusRepository: EcampusHttpRepository) => {
                return new GetStudentProfileUseCase(ecampusRepository);
            },
            inject: [EcampusHttpRepository]
        },
        {
            provide: LoginEcampusUseCase,
            useFactory: (
                ecampusAuthenticator: EcampusAuthService,
                accessTokenService: JwtAccessTokenService
            ) => {
                return new LoginEcampusUseCase(ecampusAuthenticator, accessTokenService);
            },
            inject: [EcampusAuthService, JwtAccessTokenService]
        },
        {
            provide: LogoutEcampusUseCase,
            useFactory: (ecampusRepository: EcampusHttpRepository) => {
                return new LogoutEcampusUseCase(ecampusRepository);
            },
            inject: [EcampusHttpRepository]
        }
    ]
})
export class EcampusModule {}

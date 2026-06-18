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
import { CryptoCredentialVault } from '@ecampus/infrastructure/security/crypto-credential-vault';
import { JwtAccessTokenService } from '@ecampus/infrastructure/security/jwt-access-token-service';
import { FileSessionStore } from '@ecampus/infrastructure/storage/file-session-store';
import { EcampusController } from '@ecampus/presentation/http/ecampus.controller';
import { EcampusJwtGuard } from '@ecampus/presentation/http/guards/ecampus-jwt.guard';

@Module({
    controllers: [EcampusController],
    providers: [
        CryptoCredentialVault,
        JwtAccessTokenService,
        FileSessionStore,
        EcampusJwtGuard,
        {
            provide: EcampusAuthService,
            useFactory: (sessionStore: FileSessionStore, credentialVault: CryptoCredentialVault) => {
                return new EcampusAuthService(sessionStore, credentialVault);
            },
            inject: [FileSessionStore, CryptoCredentialVault]
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
                credentialVault: CryptoCredentialVault,
                ecampusAuthenticator: EcampusAuthService,
                accessTokenService: JwtAccessTokenService
            ) => {
                return new LoginEcampusUseCase(credentialVault, ecampusAuthenticator, accessTokenService);
            },
            inject: [CryptoCredentialVault, EcampusAuthService, JwtAccessTokenService]
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

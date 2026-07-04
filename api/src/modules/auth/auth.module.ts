import { Module } from '@nestjs/common';
import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { AuthenticateAcademicRequestUseCase } from '@auth/application/use-cases/authenticate-academic-request.usecase';
import { JwtAccessTokenService } from '@auth/infrastructure/security/jwt-access-token-service';
import { RedisAcademicSessionRegistry } from '@auth/infrastructure/redis/redis-academic-session-registry';
import { AcademicAuthGuard } from '@auth/presentation/http/guards/academic-auth.guard';

@Module({
    providers: [
        JwtAccessTokenService,
        RedisAcademicSessionRegistry,
        AcademicAuthGuard,
        { provide: AccessTokenService, useExisting: JwtAccessTokenService },
        { provide: AcademicSessionRegistry, useExisting: RedisAcademicSessionRegistry },
        {
            provide: AuthenticateAcademicRequestUseCase,
            useFactory: (accessTokenService: AccessTokenService, sessionRegistry: AcademicSessionRegistry) =>
                new AuthenticateAcademicRequestUseCase(accessTokenService, sessionRegistry),
            inject: [AccessTokenService, AcademicSessionRegistry]
        }
    ],
    exports: [
        AccessTokenService,
        AcademicSessionRegistry,
        AcademicAuthGuard,
        AuthenticateAcademicRequestUseCase
    ]
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { JwtAccessTokenService } from '@auth/infrastructure/security/jwt-access-token-service';
import { RedisAcademicSessionRegistry } from '@auth/infrastructure/redis/redis-academic-session-registry';
import { AcademicAuthGuard } from '@auth/presentation/http/guards/academic-auth.guard';

@Module({
    providers: [
        JwtAccessTokenService,
        RedisAcademicSessionRegistry,
        AcademicAuthGuard,
        { provide: AccessTokenService, useExisting: JwtAccessTokenService },
        { provide: AcademicSessionRegistry, useExisting: RedisAcademicSessionRegistry }
    ],
    exports: [
        AccessTokenService,
        AcademicSessionRegistry,
        AcademicAuthGuard
    ]
})
export class AuthModule {}

import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';

interface RequestWithAcademicCredentials {
    headers: {
        authorization?: string;
    };
    academicCredentials?: AcademicCredentials;
}

@Injectable()
export class AcademicAuthGuard implements CanActivate {
    constructor(
        private readonly accessTokenService: AccessTokenService,
        private readonly sessionRegistry: AcademicSessionRegistry
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithAcademicCredentials>();
        const token = this.extractBearerToken(request.headers.authorization);

        try {
            const credentials = this.accessTokenService.verify(token);
            const isActive = await this.sessionRegistry.isActive(credentials);
            if (!isActive) {
                throw new Error('Academic session is not active.');
            }

            request.academicCredentials = credentials;
            return true;
        } catch {
            throw new UnauthorizedException('Sua sessao expirou. Entre novamente.');
        }
    }

    private extractBearerToken(authorization?: string): string {
        if (!authorization) {
            throw new UnauthorizedException('Sua sessao nao foi encontrada. Entre novamente.');
        }

        const [scheme, token] = authorization.split(' ');
        if (scheme !== 'Bearer' || !token) {
            throw new UnauthorizedException('Sua sessao esta invalida. Entre novamente.');
        }

        return token;
    }
}

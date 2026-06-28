import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AiAuthenticatedUser } from '@ai/domain/entities/ai-authenticated-user.entity';
import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';

interface RequestWithAiUser {
    headers: {
        authorization?: string;
    };
    aiUser?: AiAuthenticatedUser;
}

@Injectable()
export class AiAuthGuard implements CanActivate {
    constructor(
        private readonly accessTokenService: AccessTokenService,
        private readonly sessionRegistry: AcademicSessionRegistry
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithAiUser>();
        const token = this.extractBearerToken(request.headers.authorization);

        try {
            const credentials = this.accessTokenService.verify(token);
            const isActive = await this.sessionRegistry.isActive(credentials);
            if (!isActive) {
                throw new Error('Academic session is not active.');
            }

            request.aiUser = { id: credentials.cpf };
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

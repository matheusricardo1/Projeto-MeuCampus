import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AiAuthenticatedUser } from '@ai/domain/models/ai-authenticated-user';
import { JwtAccessTokenService } from '@ecampus/infrastructure/security/jwt-access-token-service';

interface RequestWithAiUser {
    headers: {
        authorization?: string;
    };
    aiUser?: AiAuthenticatedUser;
}

@Injectable()
export class AiAuthGuard implements CanActivate {
    constructor(private readonly accessTokenService: JwtAccessTokenService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<RequestWithAiUser>();
        const token = this.extractBearerToken(request.headers.authorization);

        try {
            const credentials = this.accessTokenService.verify(token);
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

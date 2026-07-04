import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AiAuthenticatedUser } from '@ai/domain/entities/ai-authenticated-user.entity';
import { AuthenticateAcademicRequestUseCase } from '@auth/application/use-cases/authenticate-academic-request.usecase';

interface RequestWithAiUser {
    headers: {
        authorization?: string;
    };
    aiUser?: AiAuthenticatedUser;
}

@Injectable()
export class AiAuthGuard implements CanActivate {
    constructor(
        private readonly authenticateRequest: AuthenticateAcademicRequestUseCase
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithAiUser>();
        const token = this.extractBearerToken(request.headers.authorization);

        try {
            const credentials = await this.authenticateRequest.execute(token);
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

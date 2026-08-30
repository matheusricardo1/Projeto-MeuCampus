import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthenticateRuDigitalRequestUseCase } from '@ru-digital/application/use-cases/authenticate-ru-digital-request.usecase';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';

interface RequestWithRuDigitalCredentials {
    headers: {
        authorization?: string;
    };
    ruDigitalCredentials?: RuDigitalCredentials;
}

@Injectable()
export class RuDigitalAuthGuard implements CanActivate {
    constructor(private readonly authenticateRequest: AuthenticateRuDigitalRequestUseCase) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithRuDigitalCredentials>();
        const token = this.extractBearerToken(request.headers.authorization);

        try {
            request.ruDigitalCredentials = await this.authenticateRequest.execute(token);
            return true;
        } catch {
            throw new UnauthorizedException('Sua sessao do RU Digital expirou. Entre novamente.');
        }
    }

    private extractBearerToken(authorization?: string): string {
        if (!authorization) {
            throw new UnauthorizedException('Sua sessao do RU Digital nao foi encontrada. Entre novamente.');
        }

        const [scheme, token] = authorization.split(' ');
        if (scheme !== 'Bearer' || !token) {
            throw new UnauthorizedException('Sua sessao do RU Digital esta invalida. Entre novamente.');
        }

        return token;
    }
}

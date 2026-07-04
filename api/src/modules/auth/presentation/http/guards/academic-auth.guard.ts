import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthenticateAcademicRequestUseCase } from '@auth/application/use-cases/authenticate-academic-request.usecase';
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
        private readonly authenticateRequest: AuthenticateAcademicRequestUseCase
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithAcademicCredentials>();
        const token = this.extractBearerToken(request.headers.authorization);

        try {
            request.academicCredentials = await this.authenticateRequest.execute(token);
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

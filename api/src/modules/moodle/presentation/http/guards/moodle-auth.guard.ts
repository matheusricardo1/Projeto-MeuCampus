import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthenticateMoodleRequestUseCase } from '@moodle/application/use-cases/authenticate-moodle-request.usecase';
import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';

interface RequestWithMoodleCredentials {
    headers: {
        authorization?: string;
    };
    moodleCredentials?: MoodleCredentials;
}

@Injectable()
export class MoodleAuthGuard implements CanActivate {
    constructor(private readonly authenticateRequest: AuthenticateMoodleRequestUseCase) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithMoodleCredentials>();
        const token = this.extractBearerToken(request.headers.authorization);

        try {
            request.moodleCredentials = await this.authenticateRequest.execute(token);
            return true;
        } catch {
            throw new UnauthorizedException('Sua sessao do Moodle expirou. Entre novamente.');
        }
    }

    private extractBearerToken(authorization?: string): string {
        if (!authorization) {
            throw new UnauthorizedException('Sua sessao do Moodle nao foi encontrada. Entre novamente.');
        }

        const [scheme, token] = authorization.split(' ');
        if (scheme !== 'Bearer' || !token) {
            throw new UnauthorizedException('Sua sessao do Moodle esta invalida. Entre novamente.');
        }

        return token;
    }
}

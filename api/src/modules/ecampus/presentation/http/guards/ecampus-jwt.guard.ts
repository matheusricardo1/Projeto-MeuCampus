import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import { JwtAccessTokenService } from '@ecampus/infrastructure/security/jwt-access-token-service';

interface RequestWithEcampusCredentials {
    headers: {
        authorization?: string;
    };
    ecampusCredentials?: EcampusCredentials;
}

@Injectable()
export class EcampusJwtGuard implements CanActivate {
    constructor(private readonly accessTokenService: JwtAccessTokenService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<RequestWithEcampusCredentials>();
        const token = this.extractBearerToken(request.headers.authorization);

        try {
            request.ecampusCredentials = this.accessTokenService.verify(token);
            return true;
        } catch (error) {
            throw new UnauthorizedException("Invalid or expired bearer token.");
        }
    }

    private extractBearerToken(authorization?: string): string {
        if (!authorization) {
            throw new UnauthorizedException("Missing bearer token.");
        }

        const [scheme, token] = authorization.split(' ');
        if (scheme !== 'Bearer' || !token) {
            throw new UnauthorizedException("Authorization header must use Bearer token.");
        }

        return token;
    }
}

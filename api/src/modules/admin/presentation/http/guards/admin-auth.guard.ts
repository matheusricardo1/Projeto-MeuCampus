import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminJwtService, type AdminCredentials } from '@admin/infrastructure/security/admin-jwt.service';

interface RequestWithAdminCredentials {
    headers: {
        authorization?: string;
    };
    adminCredentials?: AdminCredentials;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
    constructor(private readonly adminJwtService: AdminJwtService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<RequestWithAdminCredentials>();
        const token = this.extractBearerToken(request.headers.authorization);

        try {
            request.adminCredentials = this.adminJwtService.verify(token);
            return true;
        } catch {
            throw new UnauthorizedException('Sessao de admin invalida ou expirada.');
        }
    }

    private extractBearerToken(authorization?: string): string {
        if (!authorization) {
            throw new UnauthorizedException('Sessao de admin nao encontrada.');
        }

        const [scheme, token] = authorization.split(' ');
        if (scheme !== 'Bearer' || !token) {
            throw new UnauthorizedException('Sessao de admin invalida.');
        }

        return token;
    }
}

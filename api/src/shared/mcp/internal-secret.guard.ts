import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalSecretGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
        const secret = request.headers['x-internal-secret'];

        if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
            throw new UnauthorizedException('Invalid internal secret.');
        }

        return true;
    }
}

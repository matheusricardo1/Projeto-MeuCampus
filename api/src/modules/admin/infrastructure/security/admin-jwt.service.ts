import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';

export interface AdminCredentials {
    email: string;
}

interface AdminJwtPayload {
    sub: string;
    version: 1;
}

/**
 * Deliberately simpler than JwtAccessTokenService (the eCampus one) — there's
 * no third-party session blob to carry, just a fixed owner credential, so
 * this is a plain sign/verify with its own secret (never ECAMPUS_JWT_SECRET —
 * a leaked academic token must never double as an admin token).
 */
export class AdminJwtService {
    private readonly jwtService: JwtService;

    constructor(secret: string | undefined = process.env.ADMIN_JWT_SECRET) {
        if (!secret) {
            throw new Error('CRITICAL: ADMIN_JWT_SECRET must be defined.');
        }

        this.jwtService = new JwtService({
            secret,
            signOptions: {
                expiresIn: (process.env.ADMIN_JWT_EXPIRES_IN || '12h') as StringValue
            }
        });
    }

    sign(email: string): string {
        return this.jwtService.sign({ sub: email, version: 1 } satisfies AdminJwtPayload);
    }

    verify(token: string): AdminCredentials {
        const payload = this.jwtService.verify<AdminJwtPayload>(token);

        if (!payload.sub || payload.version !== 1) {
            throw new Error('Invalid admin access token payload.');
        }

        return { email: payload.sub };
    }
}

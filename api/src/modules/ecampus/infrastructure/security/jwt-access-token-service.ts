import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import type { AccessTokenService } from '@ecampus/application/ports/access-token-service';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';

interface EcampusJwtPayload {
    sub: string;
    version: 2;
}

export class JwtAccessTokenService implements AccessTokenService {
    private readonly jwtService: JwtService;

    constructor(
        secret: string | undefined = process.env.ECAMPUS_JWT_SECRET || process.env.JWT_SECRET
    ) {
        if (!secret) {
            throw new Error("CRITICAL: ECAMPUS_JWT_SECRET or JWT_SECRET must be defined.");
        }

        this.jwtService = new JwtService({
            secret,
            signOptions: {
                expiresIn: (process.env.ECAMPUS_JWT_EXPIRES_IN || '2h') as StringValue
            }
        });
    }

    sign(credentials: EcampusCredentials): string {
        return this.jwtService.sign({
            sub: credentials.cpf,
            version: 2
        } satisfies EcampusJwtPayload);
    }

    verify(token: string): EcampusCredentials {
        const payload = this.jwtService.verify<EcampusJwtPayload>(token);
        const legacyPasswordClaim = ['encrypted', 'Password'].join('');

        if (!payload.sub || payload.version !== 2 || legacyPasswordClaim in payload) {
            throw new Error("Invalid eCampus token payload.");
        }

        return {
            cpf: payload.sub
        };
    }
}

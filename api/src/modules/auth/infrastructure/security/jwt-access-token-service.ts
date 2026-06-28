import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { AccessTokenService } from '@auth/application/ports/access-token-service';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';

interface AcademicJwtPayload {
    sub: string;
    session: string;
    version: 3;
}

export class JwtAccessTokenService extends AccessTokenService {
    private readonly jwtService: JwtService;
    private readonly encryptionKey: Buffer;

    constructor(
        secret: string | undefined = process.env.ECAMPUS_JWT_SECRET || process.env.JWT_SECRET
    ) {
        super();
        if (!secret) {
            throw new Error("CRITICAL: ECAMPUS_JWT_SECRET or JWT_SECRET must be defined.");
        }

        this.encryptionKey = createHash('sha256').update(secret).digest();
        this.jwtService = new JwtService({
            secret,
            signOptions: {
                expiresIn: (process.env.ECAMPUS_JWT_EXPIRES_IN || '2h') as StringValue
            }
        });
    }

    sign(credentials: AcademicCredentials): string {
        if (!credentials.session) {
            throw new Error("Session payload is required to sign the access token.");
        }

        return this.jwtService.sign({
            sub: credentials.cpf,
            session: this.encryptSession(credentials.session),
            version: 3
        } satisfies AcademicJwtPayload);
    }

    verify(token: string): AcademicCredentials {
        const payload = this.jwtService.verify<AcademicJwtPayload>(token);

        if (!payload.sub || payload.version !== 3 || !payload.session) {
            throw new Error("Invalid access token payload.");
        }

        return {
            cpf: payload.sub,
            session: this.decryptSession(payload.session)
        };
    }

    private encryptSession(session: Record<string, unknown>): string {
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        const serialized = JSON.stringify(session);
        const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();

        return [iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join('.');
    }

    private decryptSession(value: string): Record<string, unknown> {
        const [ivPart, authTagPart, encryptedPart] = value.split('.');

        if (!ivPart || !authTagPart || !encryptedPart) {
            throw new Error("Invalid encrypted session payload.");
        }

        const decipher = createDecipheriv(
            'aes-256-gcm',
            this.encryptionKey,
            Buffer.from(ivPart, 'base64url')
        );

        decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(encryptedPart, 'base64url')),
            decipher.final()
        ]).toString('utf8');

        const parsed = JSON.parse(decrypted);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error("Invalid decrypted session payload.");
        }

        return parsed as Record<string, unknown>;
    }
}

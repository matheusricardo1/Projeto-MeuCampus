import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { AcademicSessionRegistry } from '@academic/application/ports/academic-session-registry';
import type { AcademicCredentials } from '@academic/domain/models/academic-credentials';
import { createRedisConnectionOptions } from '@/shared/redis-connection';

const SESSION_TTL_SECONDS = 60 * 60 * 2;

@Injectable()
export class EcampusSessionRegistry extends AcademicSessionRegistry {
    private readonly redis = new Redis(createRedisConnectionOptions());

    async activate(credentials: AcademicCredentials): Promise<void> {
        await this.redis.set(this.getKey(credentials.cpf), this.fingerprint(credentials), 'EX', SESSION_TTL_SECONDS);
    }

    async invalidate(cpf: string): Promise<void> {
        await this.redis.del(this.getKey(cpf));
    }

    async isActive(credentials: AcademicCredentials): Promise<boolean> {
        const storedFingerprint = await this.redis.get(this.getKey(credentials.cpf));
        return storedFingerprint === this.fingerprint(credentials);
    }

    private getKey(cpf: string): string {
        return `ecampus:session:${cpf}`;
    }

    private fingerprint(credentials: AcademicCredentials): string {
        return createHash('sha256')
            .update(JSON.stringify(credentials.session ?? null))
            .digest('hex');
    }
}

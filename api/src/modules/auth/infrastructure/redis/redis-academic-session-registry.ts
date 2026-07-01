import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { createRedisConnectionOptions } from '@/shared/redis-connection';

const SESSION_TTL_SECONDS = 60 * 30;
type SessionState = { status: 'active' | 'invalid'; updatedAt: string; reason?: string };

@Injectable()
export class RedisAcademicSessionRegistry extends AcademicSessionRegistry {
    private readonly redis = new Redis(createRedisConnectionOptions());

    async activate(credentials: AcademicCredentials): Promise<void> {
        await Promise.all([
            this.redis.set(this.getKey(credentials.cpf), this.fingerprint(credentials), 'EX', SESSION_TTL_SECONDS),
            this.redis.set(this.getStateKey(credentials.cpf), JSON.stringify({
                status: 'active',
                updatedAt: new Date().toISOString()
            } satisfies SessionState), 'EX', SESSION_TTL_SECONDS)
        ]);
    }

    async invalidate(cpf: string): Promise<void> {
        await Promise.all([
            this.redis.del(this.getKey(cpf)),
            this.redis.set(this.getStateKey(cpf), JSON.stringify({
                status: 'invalid',
                reason: 'api-invalidation',
                updatedAt: new Date().toISOString()
            } satisfies SessionState), 'EX', SESSION_TTL_SECONDS)
        ]);
    }

    async isActive(credentials: AcademicCredentials): Promise<boolean> {
        const [storedFingerprint, rawState] = await Promise.all([
            this.redis.get(this.getKey(credentials.cpf)),
            this.redis.get(this.getStateKey(credentials.cpf))
        ]);

        if (storedFingerprint !== this.fingerprint(credentials)) {
            return false;
        }

        if (!rawState) {
            return true;
        }

        return this.parseState(rawState).status === 'active';
    }

    private getKey(cpf: string): string {
        return `ecampus:session:${cpf}`;
    }

    private getStateKey(cpf: string): string {
        return `ecampus:session-state:${cpf}`;
    }

    private fingerprint(credentials: AcademicCredentials): string {
        return createHash('sha256')
            .update(JSON.stringify(credentials.session ?? null))
            .digest('hex');
    }

    private parseState(rawState: string): SessionState {
        try {
            const state = JSON.parse(rawState) as SessionState;
            if (state.status === 'active' || state.status === 'invalid') {
                return state;
            }
        } catch {
            // Invalid state means the session cannot be trusted.
        }

        return {
            status: 'invalid',
            updatedAt: new Date().toISOString(),
            reason: 'invalid-session-state'
        };
    }
}

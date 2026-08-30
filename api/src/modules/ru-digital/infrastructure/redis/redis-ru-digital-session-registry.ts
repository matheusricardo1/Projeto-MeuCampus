import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { RuDigitalSessionRegistry } from '@ru-digital/application/ports/ru-digital-session-registry';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';
import { createApiRedisConnectionOptions } from '@/shared/redis-connection';

const SESSION_TTL_SECONDS = 60 * 30;
type SessionState = { status: 'active' | 'invalid'; updatedAt: string; reason?: string };

@Injectable()
export class RedisRuDigitalSessionRegistry extends RuDigitalSessionRegistry {
    private readonly redis = new Redis(createApiRedisConnectionOptions());

    async activate(credentials: RuDigitalCredentials): Promise<void> {
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

    async isActive(credentials: RuDigitalCredentials): Promise<boolean> {
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
        return `rudigital:session:${cpf}`;
    }

    private getStateKey(cpf: string): string {
        return `rudigital:session-state:${cpf}`;
    }

    private fingerprint(credentials: RuDigitalCredentials): string {
        return createHash('sha256').update(JSON.stringify(credentials.session ?? null)).digest('hex');
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

        return { status: 'invalid', updatedAt: new Date().toISOString(), reason: 'invalid-session-state' };
    }
}

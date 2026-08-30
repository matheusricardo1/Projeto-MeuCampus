import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { MoodleSessionRegistry } from '@moodle/application/ports/moodle-session-registry';
import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';
import { moodleIdentity } from '@moodle/application/services/moodle-identity';
import { createApiRedisConnectionOptions } from '@/shared/redis-connection';

const SESSION_TTL_SECONDS = 60 * 30;
type SessionState = { status: 'active' | 'invalid'; updatedAt: string; reason?: string };

@Injectable()
export class RedisMoodleSessionRegistry extends MoodleSessionRegistry {
    private readonly redis = new Redis(createApiRedisConnectionOptions());

    async activate(credentials: MoodleCredentials): Promise<void> {
        const identity = moodleIdentity(credentials);
        await Promise.all([
            this.redis.set(this.getKey(identity), this.fingerprint(credentials), 'EX', SESSION_TTL_SECONDS),
            this.redis.set(this.getStateKey(identity), JSON.stringify({
                status: 'active',
                updatedAt: new Date().toISOString()
            } satisfies SessionState), 'EX', SESSION_TTL_SECONDS)
        ]);
    }

    async invalidate(identity: string): Promise<void> {
        await Promise.all([
            this.redis.del(this.getKey(identity)),
            this.redis.set(this.getStateKey(identity), JSON.stringify({
                status: 'invalid',
                reason: 'api-invalidation',
                updatedAt: new Date().toISOString()
            } satisfies SessionState), 'EX', SESSION_TTL_SECONDS)
        ]);
    }

    async isActive(credentials: MoodleCredentials): Promise<boolean> {
        const identity = moodleIdentity(credentials);
        const [storedFingerprint, rawState] = await Promise.all([
            this.redis.get(this.getKey(identity)),
            this.redis.get(this.getStateKey(identity))
        ]);

        if (storedFingerprint !== this.fingerprint(credentials)) {
            return false;
        }

        if (!rawState) {
            return true;
        }

        return this.parseState(rawState).status === 'active';
    }

    private getKey(identity: string): string {
        return `moodle:session:${identity}`;
    }

    private getStateKey(identity: string): string {
        return `moodle:session-state:${identity}`;
    }

    private fingerprint(credentials: MoodleCredentials): string {
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

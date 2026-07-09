import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { createApiRedisConnectionOptions } from '@/shared/redis-connection';

const KEY_PREFIX = 'ai:quota';

export interface AiQuotaCheckResult {
    allowed: boolean;
    used: number;
    limit: number;
}

@Injectable()
export class AiQuotaService implements OnModuleDestroy {
    private readonly redis = new Redis(createApiRedisConnectionOptions());

    async consume(pseudonymousUserId: string, limit: number): Promise<AiQuotaCheckResult> {
        const key = this.buildKey(pseudonymousUserId);
        const used = await this.redis.incr(key);

        if (used === 1) {
            await this.redis.expireat(key, this.secondsUntilMidnightUtc());
        }

        return { allowed: used <= limit, used, limit };
    }

    async release(pseudonymousUserId: string): Promise<void> {
        const key = this.buildKey(pseudonymousUserId);
        await this.redis.decr(key);
    }

    private buildKey(pseudonymousUserId: string): string {
        const today = new Date().toISOString().slice(0, 10);
        return `${KEY_PREFIX}:${pseudonymousUserId}:${today}`;
    }

    private secondsUntilMidnightUtc(): number {
        const now = new Date();
        const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
        return Math.ceil(midnight / 1000);
    }

    async onModuleDestroy(): Promise<void> {
        await this.redis.quit();
    }
}

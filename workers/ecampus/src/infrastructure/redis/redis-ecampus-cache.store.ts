import type Redis from 'ioredis';
import type { EcampusCacheStore } from '@/application/ports/ecampus-cache-store';
import { getEcampusCacheKey, getEcampusUserCachePattern, type EcampusCachedResource } from '@/ecampus-cache';

export class RedisEcampusCacheStore implements EcampusCacheStore {
    constructor(private readonly redis: Redis) {}

    async save<T>(resource: EcampusCachedResource, cpf: string, value: T, extra?: string): Promise<void> {
        await this.redis.set(getEcampusCacheKey(resource, cpf, extra), JSON.stringify(value), 'EX', 3600);
    }

    async clearUserCache(cpf: string): Promise<number> {
        const pattern = getEcampusUserCachePattern(cpf);
        let cursor = '0';
        let deletedKeys = 0;

        do {
            const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;

            if (keys.length > 0) {
                deletedKeys += await this.redis.del(...keys);
            }
        } while (cursor !== '0');

        return deletedKeys;
    }
}

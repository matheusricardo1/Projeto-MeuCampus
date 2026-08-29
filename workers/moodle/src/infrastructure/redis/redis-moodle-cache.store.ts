import type Redis from 'ioredis';
import type { MoodleCacheStore } from '@/application/ports/moodle-cache-store';
import { getMoodleCacheKey, getMoodleUserCachePattern } from '@/infrastructure/redis/moodle-cache-keys';
import { decryptCachePayload, encryptCachePayload } from '@/infrastructure/crypto/moodle-cache-cipher';
import type { MoodleCachedResource } from '@/domain/value-objects/moodle-cached-resource';

export class RedisMoodleCacheStore implements MoodleCacheStore {
    constructor(private readonly redis: Redis) {}

    async save<T>(resource: MoodleCachedResource, identity: string, value: T, extra?: string): Promise<void> {
        await this.redis.set(getMoodleCacheKey(resource, identity, extra), encryptCachePayload(value), 'EX', 1800);
    }

    async get<T>(resource: MoodleCachedResource, identity: string, extra?: string): Promise<T | null> {
        const raw = await this.redis.get(getMoodleCacheKey(resource, identity, extra));
        return raw ? decryptCachePayload<T>(raw) : null;
    }

    async clearUserCache(identity: string): Promise<number> {
        const pattern = getMoodleUserCachePattern(identity);
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

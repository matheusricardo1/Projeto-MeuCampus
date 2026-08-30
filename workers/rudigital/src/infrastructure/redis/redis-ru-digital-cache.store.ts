import type Redis from 'ioredis';
import type { RuDigitalCacheStore } from '@/application/ports/ru-digital-cache-store';
import { getRuDigitalCacheKey, getRuDigitalUserCachePattern } from '@/infrastructure/redis/ru-digital-cache-keys';
import { decryptCachePayload, encryptCachePayload } from '@/infrastructure/crypto/ru-digital-cache-cipher';
import type { RuDigitalCachedResource } from '@/domain/value-objects/ru-digital-cached-resource';

export class RedisRuDigitalCacheStore implements RuDigitalCacheStore {
    constructor(private readonly redis: Redis) {}

    async save<T>(resource: RuDigitalCachedResource, cpf: string, value: T, extra?: string): Promise<void> {
        await this.redis.set(getRuDigitalCacheKey(resource, cpf, extra), encryptCachePayload(value), 'EX', 1800);
    }

    async get<T>(resource: RuDigitalCachedResource, cpf: string, extra?: string): Promise<T | null> {
        const raw = await this.redis.get(getRuDigitalCacheKey(resource, cpf, extra));
        return raw ? decryptCachePayload<T>(raw) : null;
    }

    async clearUserCache(cpf: string): Promise<number> {
        const pattern = getRuDigitalUserCachePattern(cpf);
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

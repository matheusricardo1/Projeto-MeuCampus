import type { RedisOptions } from 'ioredis';

export function createRedisConnectionOptions(): RedisOptions {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
        return {
            ...parseRedisUrl(redisUrl),
            maxRetriesPerRequest: null
        };
    }

    return {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null
    };
}

function parseRedisUrl(value: string): RedisOptions {
    const url = new URL(value);

    return {
        host: url.hostname,
        port: url.port ? Number(url.port) : 6379,
        username: decodeURIComponent(url.username || ''),
        password: url.password ? decodeURIComponent(url.password) : undefined,
        db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
        tls: url.protocol === 'rediss:' ? {} : undefined
    };
}


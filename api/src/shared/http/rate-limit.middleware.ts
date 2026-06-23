import type { NextFunction, Request, Response } from 'express';
import { appLogger } from '@/shared/logging/app-logger';

interface RateLimitBucket {
    count: number;
    resetAt: number;
}

interface RateLimitRule {
    limit: number;
    windowMs: number;
}

const buckets = new Map<string, RateLimitBucket>();

const defaultRule: RateLimitRule = {
    limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000)
};

const loginRule: RateLimitRule = {
    limit: Number(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS || 10),
    windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 60_000)
};

export function rateLimitMiddleware(request: Request, response: Response, next: NextFunction): void {
    if (request.method === 'OPTIONS' || request.path === '/ecampus/health') {
        next();
        return;
    }

    const now = Date.now();
    const rule = request.path === '/ecampus/login' ? loginRule : defaultRule;
    const key = `${request.ip}:${request.path === '/ecampus/login' ? 'login' : 'api'}`;
    const bucket = getBucket(key, now, rule);

    bucket.count += 1;
    cleanupExpiredBuckets(now);

    const remaining = Math.max(0, rule.limit - bucket.count);
    response.setHeader('RateLimit-Limit', String(rule.limit));
    response.setHeader('RateLimit-Remaining', String(remaining));
    response.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count <= rule.limit) {
        next();
        return;
    }

    appLogger.warning('Rate limit exceeded.', {
        path: request.originalUrl,
        ip: request.ip,
        limit: rule.limit,
        windowMs: rule.windowMs
    });

    response.status(429).json({
        statusCode: 429,
        message: 'Muitas tentativas. Aguarde um minuto e tente novamente.',
        error: 'Muitas tentativas',
        path: request.originalUrl,
        timestamp: new Date().toISOString()
    });
}

function getBucket(key: string, now: number, rule: RateLimitRule): RateLimitBucket {
    const current = buckets.get(key);
    if (current && current.resetAt > now) {
        return current;
    }

    const nextBucket = {
        count: 0,
        resetAt: now + rule.windowMs
    };
    buckets.set(key, nextBucket);
    return nextBucket;
}

function cleanupExpiredBuckets(now: number): void {
    if (buckets.size < 500) return;

    for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
        }
    }
}

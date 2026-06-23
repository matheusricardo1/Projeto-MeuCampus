import type { NextFunction, Request, Response } from 'express';
import { appLogger } from '@/shared/logging/app-logger';

type OriginMatcher = (origin: string) => boolean;

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createRequestHardeningMiddleware(isAllowedOrigin: OriginMatcher) {
    return (request: Request, response: Response, next: NextFunction): void => {
        if (!unsafeMethods.has(request.method)) {
            next();
            return;
        }

        const origin = request.get('origin');
        if (origin && !isAllowedOrigin(origin)) {
            appLogger.warning('Blocked request from disallowed origin.', {
                method: request.method,
                path: request.originalUrl,
                origin,
                ip: request.ip
            });

            response.status(403).json({
                statusCode: 403,
                message: 'Origin is not allowed.',
                error: 'Forbidden',
                path: request.originalUrl,
                timestamp: new Date().toISOString()
            });
            return;
        }

        if (request.method !== 'GET' && !request.is('application/json') && hasRequestBody(request)) {
            response.status(415).json({
                statusCode: 415,
                message: 'Content-Type must be application/json.',
                error: 'UnsupportedMediaType',
                path: request.originalUrl,
                timestamp: new Date().toISOString()
            });
            return;
        }

        next();
    };
}

function hasRequestBody(request: Request): boolean {
    const length = Number(request.get('content-length') || 0);
    return length > 0 || Boolean(request.get('transfer-encoding'));
}

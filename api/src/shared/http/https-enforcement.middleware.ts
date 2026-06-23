import type { NextFunction, Request, Response } from 'express';
import { appLogger } from '@/shared/logging/app-logger';

export function httpsEnforcementMiddleware(request: Request, response: Response, next: NextFunction): void {
    if (process.env.NODE_ENV !== 'production') {
        next();
        return;
    }

    const forwardedProto = request.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const isHttps = request.secure || forwardedProto === 'https';

    if (isHttps) {
        next();
        return;
    }

    appLogger.warning('Blocked non-HTTPS request in production.', {
        method: request.method,
        path: request.originalUrl,
        ip: request.ip
    });

    response.status(403).json({
        statusCode: 403,
        message: 'HTTPS is required.',
        error: 'Forbidden',
        path: request.originalUrl,
        timestamp: new Date().toISOString()
    });
}


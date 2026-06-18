import type { NextFunction, Request, Response } from 'express';
import { appLogger } from '@/shared/logging/app-logger';

export function accessLogMiddleware(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    response.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

        appLogger.access(`${request.method} ${request.originalUrl}`, {
            statusCode: response.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            ip: request.ip,
            userAgent: request.get('user-agent') || 'unknown'
        });
    });

    next();
}

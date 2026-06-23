import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { register } from 'tsconfig-paths';

register({
    baseUrl: __dirname,
    paths: {
        '@/*': ['*'],
        '@ecampus/*': ['modules/ecampus/*']
    }
});

const { AppModule } = require('@/app.module') as typeof import('./app.module');
const { HttpErrorFilter } = require('@/shared/http/http-error.filter') as typeof import('./shared/http/http-error.filter');
const { accessLogMiddleware } = require('@/shared/http/access-log.middleware') as typeof import('./shared/http/access-log.middleware');
const { securityHeadersMiddleware } = require('@/shared/http/security-headers.middleware') as typeof import('./shared/http/security-headers.middleware');
const { httpsEnforcementMiddleware } = require('@/shared/http/https-enforcement.middleware') as typeof import('./shared/http/https-enforcement.middleware');
const { createRequestHardeningMiddleware } = require('@/shared/http/request-hardening.middleware') as typeof import('./shared/http/request-hardening.middleware');
const { rateLimitMiddleware } = require('@/shared/http/rate-limit.middleware') as typeof import('./shared/http/rate-limit.middleware');

export async function createNestApp(): Promise<INestApplication> {
    const app = await NestFactory.create(AppModule);
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    app.use(securityHeadersMiddleware);
    app.use(httpsEnforcementMiddleware);
    app.use(createRequestHardeningMiddleware(isAllowedOrigin));
    app.use(rateLimitMiddleware);
    app.use(accessLogMiddleware);
    app.useGlobalFilters(new HttpErrorFilter());
    app.enableShutdownHooks();
    app.enableCors({
        origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
            if (!origin || isAllowedOrigin(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
        },
        credentials: false
    });

    return app;
}

function getAllowedOrigins(): string[] {
    const rawOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    return rawOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function isAllowedOrigin(origin: string): boolean {
    return getAllowedOrigins().some((allowedOrigin) => matchesOrigin(origin, allowedOrigin));
}

function matchesOrigin(origin: string, allowedOrigin: string): boolean {
    if (allowedOrigin === '*') {
        return process.env.NODE_ENV !== 'production';
    }

    if (!allowedOrigin.includes('*')) {
        return origin === allowedOrigin;
    }

    const escapedOrigin = allowedOrigin.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escapedOrigin}$`).test(origin);
}

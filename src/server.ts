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

export async function createNestApp(): Promise<INestApplication> {
    const app = await NestFactory.create(AppModule);
    app.use(accessLogMiddleware);
    app.useGlobalFilters(new HttpErrorFilter());
    app.enableShutdownHooks();
    app.enableCors({
        origin: getAllowedOrigins(),
        credentials: false
    });

    return app;
}

function getAllowedOrigins(): string[] {
    const rawOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    return rawOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
}

import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { HttpErrorFilter } from '@/shared/http/http-error.filter';
import { accessLogMiddleware } from '@/shared/http/access-log.middleware';

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

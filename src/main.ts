// src/main.ts
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { logger } from '@ecampus/infrastructure/logging/console-logger';
import { HttpErrorFilter } from '@/shared/http/http-error.filter';
import { accessLogMiddleware } from '@/shared/http/access-log.middleware';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.use(accessLogMiddleware);
    app.useGlobalFilters(new HttpErrorFilter());
    app.enableShutdownHooks();
    app.enableCors({
        origin: getAllowedOrigins(),
        credentials: false
    });

    const port = Number(process.env.PORT || 3001);

    try {
        await app.listen(port);
        logger.info(`HTTP server running on http://localhost:${port}`);
    } catch (error: any) {
        logger.critical(`Server failed to start: ${error.message}`);
        process.exitCode = 1;
    }
}

function getAllowedOrigins(): string[] {
    const rawOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    return rawOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
}

bootstrap();

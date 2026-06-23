// src/main.ts
import { logger } from '@ecampus/infrastructure/logging/console-logger';
import { createNestApp } from '@/server';

async function bootstrap() {
    const app = await createNestApp();
    const port = Number(process.env.PORT || 3001);

    try {
        await app.listen(port);
        logger.info(`HTTP server running on http://localhost:${port}`);
    } catch (error: any) {
        logger.critical(`Server failed to start: ${error.message}`);
        process.exitCode = 1;
    }
}

bootstrap();

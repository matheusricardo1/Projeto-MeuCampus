import 'dotenv/config';
import { register } from 'tsconfig-paths';
import { EcampusScrapingWorker } from '@/infrastructure/queue/bullmq-ecampus-scraping.worker';
import { appLogger } from './infrastructure/logging/app-logger';

register({
    baseUrl: __dirname,
    paths: {
        '@/*': ['*']
    }
});

async function bootstrap() {
    const worker = new EcampusScrapingWorker();

    const shutdown = async (signal: string) => {
        appLogger.info(`Received ${signal}. Closing eCampus scraping worker...`);
        await worker.close();
        process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    await worker.run();
}

bootstrap().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    appLogger.critical(`eCampus scraping worker failed to start: ${message}`);
    process.exitCode = 1;
});

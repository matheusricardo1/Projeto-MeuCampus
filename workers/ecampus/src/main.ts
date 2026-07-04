import { config as loadDotenv } from 'dotenv';

// ENV_FILE picks which config to load (local | production), independent of
// NODE_ENV — so you can test production-shaped config locally without
// flipping framework runtime behavior. Defaults to NODE_ENV when unset.
const envTarget = process.env.ENV_FILE || (process.env.NODE_ENV === 'production' ? 'production' : 'local');
loadDotenv({ path: `.env.${envTarget}` });

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

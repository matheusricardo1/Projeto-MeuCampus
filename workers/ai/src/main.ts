import { config as loadDotenv } from 'dotenv';

// ENV_FILE picks which config to load (local | production), independent of
// NODE_ENV — so you can test production-shaped config locally without
// flipping framework runtime behavior. Defaults to NODE_ENV when unset.
const envTarget = process.env.ENV_FILE || (process.env.NODE_ENV === 'production' ? 'production' : 'local');
loadDotenv({ path: `.env.${envTarget}` });

import { AiChatWorker } from '@/infrastructure/queue/bullmq-ai-chat.worker';
import { appLogger } from '@/infrastructure/logging/app-logger';

async function bootstrap(): Promise<void> {
    const worker = new AiChatWorker();

    const shutdown = async (signal: NodeJS.Signals) => {
        appLogger.info(`Received ${signal}. Closing AI chat worker...`);
        await worker.close();
        process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    await worker.run();
}

bootstrap().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    appLogger.critical(`AI chat worker failed to start: ${message}`);
    process.exit(1);
});

import 'dotenv/config';
import { AiChatWorker } from '@/ai-chat.worker';
import { appLogger } from '@/logging/app-logger';

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

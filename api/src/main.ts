import { createNestApp } from '@/server';
import { appLogger } from '@/shared/logging/app-logger';

interface ServerConfig {
    port: number;
    host?: string;
}

async function bootstrap(): Promise<void> {
    const app = await createNestApp();
    const { port, host } = getServerConfig();

    try {
        if (host) {
            await app.listen(port, host);
        } else {
            await app.listen(port);
        }

        appLogger.info('HTTP server running.', {
            url: `http://${host ?? 'localhost'}:${port}`
        });
    } catch (error) {
        appLogger.critical('Server failed to start.', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message : String(error)
        });
        process.exitCode = 1;
    }
}

function getServerConfig(): ServerConfig {
    const rawPort = process.env.PORT ?? '3001';
    const port = Number.parseInt(rawPort, 10);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid PORT value: ${rawPort}`);
    }

    const host = process.env.HOST?.trim();
    return host ? { port, host } : { port };
}

void bootstrap();

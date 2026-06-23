import fs from 'fs/promises';
import path from 'path';
import type { SessionStore } from '@ecampus/application/ports/session-store';
import { logger } from '@ecampus/infrastructure/logging/console-logger';

export class FileSessionStore implements SessionStore {
    private readonly storageFile: string;

    constructor(fileName: string = 'saved_sessions.json') {
        const storageDirectory = process.env.SESSION_STORAGE_DIR || (process.env.VERCEL ? '/tmp' : process.cwd());
        this.storageFile = path.resolve(storageDirectory, fileName);
    }

    async saveSession(userCpf: string, cookies: object): Promise<void> {
        const data = await this.loadAll();
        data[userCpf] = cookies;

        await fs.writeFile(this.storageFile, JSON.stringify(data, null, 4), 'utf8');
        logger.info("Session saved to storage.");
    }

    async getSession(userCpf: string): Promise<object | null> {
        const data = await this.loadAll();
        return data[userCpf] || null;
    }

    async deleteSession(userCpf: string): Promise<void> {
        const data = await this.loadAll();

        if (!data[userCpf]) {
            return;
        }

        delete data[userCpf];
        await fs.writeFile(this.storageFile, JSON.stringify(data, null, 4), 'utf8');
        logger.warning("Invalid saved session removed.");
    }

    private async loadAll(): Promise<Record<string, object>> {
        try {
            const fileContent = await fs.readFile(this.storageFile, 'utf8');
            return JSON.parse(fileContent) as Record<string, object>;
        } catch (error) {
            return {};
        }
    }
}

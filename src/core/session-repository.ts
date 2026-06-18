// src/core/session-repository.ts
import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

export class SessionRepository {
    private readonly storageFile: string;

    constructor(fileName: string = 'saved_sessions.json') {
        this.storageFile = path.resolve(__dirname, '../../', fileName);
    }

    async saveSession(userCpf: string, cookies: object): Promise<void> {
        const data = await this.loadAll();
        data[userCpf] = cookies;
        
        await fs.writeFile(this.storageFile, JSON.stringify(data, null, 4), 'utf8');
        logger.info(`Session saved to storage for user ${userCpf}.`);
    }

    async getSession(userCpf: string): Promise<object | null> {
        const data = await this.loadAll();
        return data[userCpf] || null;
    }

    private async loadAll(): Promise<Record<string, any>> {
        try {
            const fileContent = await fs.readFile(this.storageFile, 'utf8');
            return JSON.parse(fileContent);
        } catch (error) {
            return {};
        }
    }
}

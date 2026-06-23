import type { SessionStore } from '@ecampus/application/ports/session-store';

export class MemorySessionStore implements SessionStore {
    private readonly sessions = new Map<string, object>();

    async saveSession(userCpf: string, cookies: object): Promise<void> {
        this.sessions.set(userCpf, cookies);
    }

    async getSession(userCpf: string): Promise<object | null> {
        return this.sessions.get(userCpf) || null;
    }

    async deleteSession(userCpf: string): Promise<void> {
        this.sessions.delete(userCpf);
    }
}

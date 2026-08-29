import type Redis from 'ioredis';
import { AuthenticationError } from '@/domain/exceptions/authentication.error';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';

const SESSION_TTL_SECONDS = 60 * 30;

type MoodleSessionStatus = 'active' | 'invalid';

interface MoodleSessionState {
    status: MoodleSessionStatus;
    updatedAt: string;
    reason?: string;
}

export class RedisMoodleSessionCoordinator implements MoodleSessionStore {
    constructor(private readonly redis: Redis) {}

    async markActive(identity: string): Promise<void> {
        await this.redis.set(this.getStateKey(identity), JSON.stringify({
            status: 'active',
            updatedAt: new Date().toISOString()
        } satisfies MoodleSessionState), 'EX', SESSION_TTL_SECONDS);
    }

    async markInvalid(identity: string, reason: string): Promise<void> {
        await this.redis.set(this.getStateKey(identity), JSON.stringify({
            status: 'invalid',
            reason,
            updatedAt: new Date().toISOString()
        } satisfies MoodleSessionState), 'EX', SESSION_TTL_SECONDS);
    }

    async assertActive(identity: string): Promise<void> {
        const rawState = await this.redis.get(this.getStateKey(identity));

        if (!rawState) {
            throw new AuthenticationError('Sua sessao do Moodle expirou. Entre novamente.');
        }

        const state = this.parseState(rawState);
        if (state.status !== 'active') {
            throw new AuthenticationError('Sua sessao do Moodle expirou. Entre novamente.');
        }
    }

    private parseState(rawState: string): MoodleSessionState {
        try {
            const state = JSON.parse(rawState) as MoodleSessionState;
            if (state.status === 'active' || state.status === 'invalid') {
                return state;
            }
        } catch {
            // Corrupted state is safer to treat as invalid.
        }

        return {
            status: 'invalid',
            updatedAt: new Date().toISOString(),
            reason: 'invalid-session-state'
        };
    }

    private getStateKey(identity: string): string {
        return `moodle:session-state:${identity}`;
    }
}

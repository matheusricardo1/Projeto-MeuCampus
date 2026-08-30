import type Redis from 'ioredis';
import { AuthenticationError } from '@/domain/exceptions/authentication.error';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';

const SESSION_TTL_SECONDS = 60 * 30;

type RuDigitalSessionStatus = 'active' | 'invalid';

interface RuDigitalSessionState {
    status: RuDigitalSessionStatus;
    updatedAt: string;
    reason?: string;
}

export class RedisRuDigitalSessionCoordinator implements RuDigitalSessionStore {
    constructor(private readonly redis: Redis) {}

    async markActive(cpf: string): Promise<void> {
        await this.redis.set(this.getStateKey(cpf), JSON.stringify({
            status: 'active',
            updatedAt: new Date().toISOString()
        } satisfies RuDigitalSessionState), 'EX', SESSION_TTL_SECONDS);
    }

    async markInvalid(cpf: string, reason: string): Promise<void> {
        await this.redis.set(this.getStateKey(cpf), JSON.stringify({
            status: 'invalid',
            reason,
            updatedAt: new Date().toISOString()
        } satisfies RuDigitalSessionState), 'EX', SESSION_TTL_SECONDS);
    }

    async assertActive(cpf: string): Promise<void> {
        const rawState = await this.redis.get(this.getStateKey(cpf));

        if (!rawState) {
            throw new AuthenticationError('Sua sessao do RU Digital expirou. Entre novamente.');
        }

        const state = this.parseState(rawState);
        if (state.status !== 'active') {
            throw new AuthenticationError('Sua sessao do RU Digital expirou. Entre novamente.');
        }
    }

    private parseState(rawState: string): RuDigitalSessionState {
        try {
            const state = JSON.parse(rawState) as RuDigitalSessionState;
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

    private getStateKey(cpf: string): string {
        return `rudigital:session-state:${cpf}`;
    }
}

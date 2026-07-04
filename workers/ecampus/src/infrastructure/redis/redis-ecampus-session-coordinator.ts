import type Redis from 'ioredis';
import { AuthenticationError } from '@/domain/exceptions/authentication.error';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';

const SESSION_TTL_SECONDS = 60 * 30;

type EcampusSessionStatus = 'active' | 'invalid';

interface EcampusSessionState {
    status: EcampusSessionStatus;
    updatedAt: string;
    reason?: string;
}

export class RedisEcampusSessionCoordinator implements EcampusSessionStore {
    constructor(private readonly redis: Redis) {}

    async markActive(cpf: string): Promise<void> {
        await this.redis.set(this.getStateKey(cpf), JSON.stringify({
            status: 'active',
            updatedAt: new Date().toISOString()
        } satisfies EcampusSessionState), 'EX', SESSION_TTL_SECONDS);
    }

    async markInvalid(cpf: string, reason: string): Promise<void> {
        await Promise.all([
            this.redis.set(this.getStateKey(cpf), JSON.stringify({
                status: 'invalid',
                reason,
                updatedAt: new Date().toISOString()
            } satisfies EcampusSessionState), 'EX', SESSION_TTL_SECONDS),
            this.redis.del(this.getSessionKey(cpf))
        ]);
    }

    async assertActive(cpf: string): Promise<void> {
        const rawState = await this.redis.get(this.getStateKey(cpf));

        if (!rawState) {
            const hasLegacySession = await this.redis.exists(this.getSessionKey(cpf));
            if (hasLegacySession) {
                return;
            }

            throw new AuthenticationError('Sua sessao expirou. Entre novamente.');
        }

        const state = this.parseState(rawState);
        if (state.status !== 'active') {
            throw new AuthenticationError('Sua sessao expirou. Entre novamente.');
        }
    }

    private parseState(rawState: string): EcampusSessionState {
        try {
            const state = JSON.parse(rawState) as EcampusSessionState;
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
        return `ecampus:session-state:${cpf}`;
    }

    private getSessionKey(cpf: string): string {
        return `ecampus:session:${cpf}`;
    }
}

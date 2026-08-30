import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalCacheStore } from '@/application/ports/ru-digital-cache-store';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';

export class LogoutRuDigitalSessionUseCase {
    constructor(
        private readonly repository: RuDigitalRepository,
        private readonly cache: RuDigitalCacheStore,
        private readonly sessions: RuDigitalSessionStore
    ) {}

    async execute(credentials: RuDigitalCredentials): Promise<{ cacheDeletedKeys: number; externalLogout: 'ok' | 'failed' }> {
        let externalLogout: 'ok' | 'failed' = 'ok';

        try {
            await this.repository.logout(credentials);
        } catch {
            externalLogout = 'failed';
        }

        const cacheDeletedKeys = await this.cache.clearUserCache(credentials.cpf);
        await this.sessions.markInvalid(credentials.cpf, 'logout');
        return { cacheDeletedKeys, externalLogout };
    }
}

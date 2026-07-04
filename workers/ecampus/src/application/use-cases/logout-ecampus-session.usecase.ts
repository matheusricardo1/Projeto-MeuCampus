import type { EcampusRepository } from '@/domain/repositories/ecampus.repository';
import type { EcampusCacheStore } from '@/application/ports/ecampus-cache-store';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';

export class LogoutEcampusSessionUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly cache: EcampusCacheStore,
        private readonly sessions: EcampusSessionStore
    ) {}

    async execute(credentials: EcampusCredentials): Promise<{ cacheDeletedKeys: number; externalLogout: 'ok' | 'failed' }> {
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

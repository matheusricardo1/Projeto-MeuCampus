import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';
import type { Balance } from '@/domain/entities/balance';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

export class GetBalanceUseCase {
    constructor(
        private readonly repository: RuDigitalRepository,
        private readonly sessions: RuDigitalSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: RuDigitalCredentials): Promise<Balance> {
        await this.sessions.assertActive(credentials.cpf);
        return this.cacheAndPublish.run('saldo', credentials.cpf, this.repository.getBalance(credentials));
    }
}

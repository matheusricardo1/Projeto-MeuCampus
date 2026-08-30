import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';
import type { LastConsumption } from '@/domain/entities/last-consumption';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

export class GetLastConsumptionUseCase {
    constructor(
        private readonly repository: RuDigitalRepository,
        private readonly sessions: RuDigitalSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: RuDigitalCredentials, restaurantId: string): Promise<LastConsumption> {
        await this.sessions.assertActive(credentials.cpf);
        return this.cacheAndPublish.run('ultimo-consumo', credentials.cpf, this.repository.getLastConsumption(credentials, restaurantId));
    }
}

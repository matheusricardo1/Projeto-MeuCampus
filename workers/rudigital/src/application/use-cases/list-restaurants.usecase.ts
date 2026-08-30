import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';
import type { Restaurant } from '@/domain/entities/restaurant';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

export class ListRestaurantsUseCase {
    constructor(
        private readonly repository: RuDigitalRepository,
        private readonly sessions: RuDigitalSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: RuDigitalCredentials): Promise<Restaurant[]> {
        await this.sessions.assertActive(credentials.cpf);
        return this.cacheAndPublish.run('restaurantes', credentials.cpf, this.repository.listRestaurants(credentials));
    }
}

import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';
import type { DailyMenu } from '@/domain/entities/daily-menu';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

export class GetDailyMenuUseCase {
    constructor(
        private readonly repository: RuDigitalRepository,
        private readonly sessions: RuDigitalSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: RuDigitalCredentials, date: string): Promise<DailyMenu> {
        await this.sessions.assertActive(credentials.cpf);
        return this.cacheAndPublish.run('cardapio', credentials.cpf, this.repository.getDailyMenu(credentials, date), date);
    }
}

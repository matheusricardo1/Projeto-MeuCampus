import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import { RuDigitalSessionRegistry } from '@ru-digital/application/ports/ru-digital-session-registry';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';

export class LogoutRuDigitalUseCase {
    constructor(
        private readonly scrapingJobService: ScrapingJobService,
        private readonly cache: RuDigitalDataRepository,
        private readonly sessions: RuDigitalSessionRegistry
    ) {}

    async execute(credentials: RuDigitalCredentials): Promise<void> {
        await this.scrapingJobService.enqueue('logout', { credentials });
        await this.cache.clearUserCache(credentials.cpf);
        await this.sessions.invalidate(credentials.cpf);
    }
}

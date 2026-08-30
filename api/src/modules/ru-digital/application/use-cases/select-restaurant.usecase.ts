import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { RuDigitalAccessTokenService } from '@ru-digital/application/ports/ru-digital-access-token-service';
import { RuDigitalSessionRegistry } from '@ru-digital/application/ports/ru-digital-session-registry';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';

export interface SelectRestaurantOutput {
    accessToken: string;
}

const SELECT_RESTAURANT_TIMEOUT_MS = 15000;

/**
 * Like login, this blocks on the job finishing and re-issues a fresh access
 * token — the chosen restaurant lives in the RU Digital session (a separate
 * cookie the worker now tracks alongside the JWT), so every request after
 * this one needs the updated session embedded in a new token.
 */
export class SelectRestaurantUseCase {
    constructor(
        private readonly scrapingJobService: ScrapingJobService,
        private readonly accessTokenService: RuDigitalAccessTokenService,
        private readonly sessions: RuDigitalSessionRegistry
    ) {}

    async execute(credentials: RuDigitalCredentials, restaurantId: string): Promise<SelectRestaurantOutput> {
        const job = await this.scrapingJobService.enqueue<{ session: Record<string, unknown> }>('select-restaurant', {
            credentials,
            restaurantId
        });

        const { session } = await job.waitUntilFinished(SELECT_RESTAURANT_TIMEOUT_MS);
        const updatedCredentials = { cpf: credentials.cpf, session };
        await this.sessions.activate(updatedCredentials);
        const accessToken = this.accessTokenService.sign(updatedCredentials);
        return { accessToken };
    }
}

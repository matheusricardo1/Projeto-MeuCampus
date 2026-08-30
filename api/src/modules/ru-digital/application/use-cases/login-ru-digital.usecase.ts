import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { RuDigitalAccessTokenService } from '@ru-digital/application/ports/ru-digital-access-token-service';
import { RuDigitalSessionRegistry } from '@ru-digital/application/ports/ru-digital-session-registry';

export interface LoginRuDigitalInput {
    cpf: string;
    password: string;
}

export interface LoginRuDigitalOutput {
    accessToken: string;
}

const LOGIN_TIMEOUT_MS = 20000;

/**
 * Unlike the eCampus login (fire-and-forget job + realtime push), this
 * blocks on the job actually finishing — RU Digital has no websocket
 * notifier wired up yet, so a synchronous wait is the simplest way to hand
 * back a usable access token in one request.
 */
export class LoginRuDigitalUseCase {
    constructor(
        private readonly scrapingJobService: ScrapingJobService,
        private readonly accessTokenService: RuDigitalAccessTokenService,
        private readonly sessions: RuDigitalSessionRegistry
    ) {}

    async execute(input: LoginRuDigitalInput): Promise<LoginRuDigitalOutput> {
        const job = await this.scrapingJobService.enqueue<{ session: Record<string, unknown> }>('login', {
            cpf: input.cpf,
            password: input.password
        });

        const { session } = await job.waitUntilFinished(LOGIN_TIMEOUT_MS);
        const credentials = { cpf: input.cpf, session };
        await this.sessions.activate(credentials);
        const accessToken = this.accessTokenService.sign(credentials);
        return { accessToken };
    }
}

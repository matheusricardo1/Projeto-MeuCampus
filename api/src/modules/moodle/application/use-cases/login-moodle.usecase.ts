import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { MoodleAccessTokenService } from '@moodle/application/ports/moodle-access-token-service';
import { MoodleSessionRegistry } from '@moodle/application/ports/moodle-session-registry';
import type { MoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';

export interface LoginMoodleInput {
    instanceId: MoodleInstanceId;
    username: string;
    password: string;
}

export interface LoginMoodleOutput {
    accessToken: string;
}

const LOGIN_TIMEOUT_MS = 20000;

/**
 * Blocks on the sync job actually finishing (like RU Digital's login, and
 * unlike eCampus's fire-and-forget + realtime push) — Moodle has no
 * websocket notifier wired up yet, so a synchronous wait is the simplest way
 * to hand back a usable access token in one request.
 */
export class LoginMoodleUseCase {
    constructor(
        private readonly scrapingJobService: ScrapingJobService,
        private readonly accessTokenService: MoodleAccessTokenService,
        private readonly sessions: MoodleSessionRegistry
    ) {}

    async execute(input: LoginMoodleInput): Promise<LoginMoodleOutput> {
        const job = await this.scrapingJobService.enqueue<{ session: Record<string, unknown> }>('login', {
            instanceId: input.instanceId,
            username: input.username,
            password: input.password
        });

        const { session } = await job.waitUntilFinished(LOGIN_TIMEOUT_MS);
        const credentials = { instanceId: input.instanceId, username: input.username, session };
        await this.sessions.activate(credentials);
        const accessToken = this.accessTokenService.sign(credentials);
        return { accessToken };
    }
}

import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { MoodleAccountLinkRepository } from '@moodle/domain/repositories/moodle-account-link.repository';
import type { MoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';
import { pseudonymousUserId } from '@/shared/security/pseudonymous-user-id';

export interface LinkMoodleAccountInput {
    cpf: string;
    instanceId: MoodleInstanceId;
    username: string;
    password: string;
}

const LOGIN_TIMEOUT_MS = 20000;

/**
 * Verifies the credential actually works against Moodle (a real login job,
 * same as the app-facing login flow) BEFORE persisting anything — never
 * store a password we haven't confirmed is correct.
 */
export class LinkMoodleAccountUseCase {
    constructor(
        private readonly scrapingJobService: ScrapingJobService,
        private readonly accountLinks: MoodleAccountLinkRepository
    ) {}

    async execute(input: LinkMoodleAccountInput): Promise<void> {
        const job = await this.scrapingJobService.enqueue('login', {
            instanceId: input.instanceId,
            username: input.username,
            password: input.password
        });
        await job.waitUntilFinished(LOGIN_TIMEOUT_MS);

        const userId = pseudonymousUserId(input.cpf);
        await this.accountLinks.link(userId, input.instanceId, input.username, input.password);
    }
}

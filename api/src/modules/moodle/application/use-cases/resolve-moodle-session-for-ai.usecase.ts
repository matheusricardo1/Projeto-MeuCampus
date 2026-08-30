import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { MoodleAccountLinkRepository } from '@moodle/domain/repositories/moodle-account-link.repository';
import { MoodleSessionRegistry } from '@moodle/application/ports/moodle-session-registry';
import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';
import type { MoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';
import { pseudonymousUserId } from '@/shared/security/pseudonymous-user-id';

export const NOT_LINKED = 'not-linked';
const LOGIN_TIMEOUT_MS = 20000;

/**
 * The "simulated SSO" step: the AI/MCP path never holds a Moodle bearer
 * token (unlike the app, which signs one at login) — it only knows the
 * student's cpf. This resolves a fresh, usable session by silently
 * re-authenticating with the student's LINKED (persisted, encrypted)
 * credential, so the student is never asked to log in to Moodle again once
 * they've connected it in Settings.
 */
export class ResolveMoodleSessionForAiUseCase {
    constructor(
        private readonly accountLinks: MoodleAccountLinkRepository,
        private readonly scrapingJobService: ScrapingJobService,
        private readonly sessions: MoodleSessionRegistry
    ) {}

    async execute(cpf: string, instanceId?: MoodleInstanceId): Promise<MoodleCredentials | typeof NOT_LINKED> {
        const userId = pseudonymousUserId(cpf);
        const linked = instanceId
            ? await this.toInstanceCredentials(userId, instanceId)
            : await this.accountLinks.findFirstCredentials(userId);

        if (!linked) {
            return NOT_LINKED;
        }

        const job = await this.scrapingJobService.enqueue('login', {
            instanceId: linked.instanceId,
            username: linked.username,
            password: linked.password
        });
        const { session } = await job.waitUntilFinished(LOGIN_TIMEOUT_MS) as { session: Record<string, unknown> };

        const credentials: MoodleCredentials = { instanceId: linked.instanceId, username: linked.username, session };
        await this.sessions.activate(credentials);
        return credentials;
    }

    private async toInstanceCredentials(
        userId: string,
        instanceId: MoodleInstanceId
    ): Promise<{ instanceId: MoodleInstanceId; username: string; password: string } | null> {
        const credentials = await this.accountLinks.findCredentials(userId, instanceId);
        return credentials ? { instanceId, ...credentials } : null;
    }
}

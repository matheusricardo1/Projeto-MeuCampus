import type { MoodleAuthenticator } from '@/application/ports/moodle-authenticator';
import type { MoodleScrapeEventPublisher } from '@/application/ports/moodle-scrape-event-publisher';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';
import type { MoodleInstanceId } from '@/config/moodle-instances';
import { moodleIdentity } from '@/application/services/moodle-identity';

export class LoginMoodleSessionUseCase {
    constructor(
        private readonly authenticator: MoodleAuthenticator,
        private readonly sessions: MoodleSessionStore,
        private readonly events: MoodleScrapeEventPublisher
    ) {}

    async execute(instanceId: MoodleInstanceId, username: string, password: string, jobId?: string): Promise<{ session: Record<string, unknown> }> {
        const identity = moodleIdentity({ instanceId, username });

        try {
            const session = await this.authenticator.authenticate({ instanceId, username }, password);
            await this.sessions.markActive(identity);
            if (jobId) {
                await this.events.publishLoginReady({ type: 'login', jobId, identity, session });
            }
            return { session };
        } catch (error) {
            if (jobId) {
                const err = error instanceof Error ? error : new Error(String(error));
                await this.events.publishLoginFailed({
                    type: 'login',
                    status: 'failed',
                    jobId,
                    identity,
                    errorName: err.name,
                    message: err.message
                }).catch(() => undefined);
            }
            throw error;
        }
    }
}

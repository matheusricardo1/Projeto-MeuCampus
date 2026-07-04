import type { EcampusAuthenticator } from '@/application/ports/ecampus-authenticator';
import type { EcampusScrapeEventPublisher } from '@/application/ports/ecampus-scrape-event-publisher';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';

export class LoginEcampusSessionUseCase {
    constructor(
        private readonly authenticator: EcampusAuthenticator,
        private readonly sessions: EcampusSessionStore,
        private readonly events: EcampusScrapeEventPublisher
    ) {}

    async execute(cpf: string, password: string, jobId?: string): Promise<{ session: Record<string, unknown> }> {
        try {
            const session = await this.authenticator.authenticate({ cpf }, password);
            await this.sessions.markActive(cpf);
            if (jobId) {
                await this.events.publishLoginReady({ type: 'login', jobId, cpf, session });
            }
            return { session };
        } catch (error) {
            if (jobId) {
                const err = error instanceof Error ? error : new Error(String(error));
                await this.events.publishLoginFailed({
                    type: 'login',
                    status: 'failed',
                    jobId,
                    cpf,
                    errorName: err.name,
                    message: err.message
                }).catch(() => undefined);
            }
            throw error;
        }
    }
}

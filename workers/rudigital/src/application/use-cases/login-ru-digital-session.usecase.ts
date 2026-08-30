import type { RuDigitalAuthenticator } from '@/application/ports/ru-digital-authenticator';
import type { RuDigitalScrapeEventPublisher } from '@/application/ports/ru-digital-scrape-event-publisher';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';

export class LoginRuDigitalSessionUseCase {
    constructor(
        private readonly authenticator: RuDigitalAuthenticator,
        private readonly sessions: RuDigitalSessionStore,
        private readonly events: RuDigitalScrapeEventPublisher
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

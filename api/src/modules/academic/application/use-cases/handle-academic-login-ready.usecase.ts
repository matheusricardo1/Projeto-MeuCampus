import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { AcademicNotificationService } from '@academic/application/ports/academic-notification-service';
import { PrefetchAcademicDataUseCase } from '@academic/application/use-cases/prefetch-academic-data.usecase';
import { appLogger } from '@/shared/logging/app-logger';

export interface AcademicLoginReadyEventInput {
    jobId: string;
    cpf: string;
    session: Record<string, unknown>;
}

export class HandleAcademicLoginReadyUseCase {
    constructor(
        private readonly sessionRegistry: AcademicSessionRegistry,
        private readonly accessTokenService: AccessTokenService,
        private readonly notifier: AcademicNotificationService,
        private readonly prefetchUseCase: PrefetchAcademicDataUseCase
    ) {}

    async execute(event: AcademicLoginReadyEventInput): Promise<void> {
        const credentials = { cpf: event.cpf, session: event.session };
        await this.sessionRegistry.activate(credentials);
        // A previous session's fingerprint is now stale — kick any socket still
        // connected under it instead of waiting for it to fail on its own.
        this.notifier.revokeUserSessions(event.cpf);
        const accessToken = this.accessTokenService.sign(credentials);
        this.notifier.emitLoginReady({ jobId: event.jobId, accessToken });

        void this.prefetchUseCase.execute(credentials).catch((error: unknown) => {
            appLogger.error('Failed to prefetch academic data after login.', {
                cpf: event.cpf,
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
        });
    }
}

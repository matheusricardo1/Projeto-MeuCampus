import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { AcademicBootstrapTracker } from '@academic/application/ports/academic-bootstrap-tracker';
import { AcademicNotificationService, type AcademicResourceFailedNotification } from '@realtime/application/ports/academic-notification-service';
import { toBootstrapNotification } from '@academic/application/services/to-bootstrap-notification';

export class HandleAcademicResourceFailedUseCase {
    constructor(
        private readonly academicDataRepository: AcademicDataRepository,
        private readonly sessionRegistry: AcademicSessionRegistry,
        private readonly bootstrapTracker: AcademicBootstrapTracker,
        private readonly notifier: AcademicNotificationService
    ) {}

    async execute(event: AcademicResourceFailedNotification): Promise<void> {
        if (event.errorName === 'AuthenticationError') {
            await Promise.all([
                this.academicDataRepository.clearUserCache(event.cpf),
                this.sessionRegistry.invalidate(event.cpf)
            ]);
        }

        const bootstrapState = await this.bootstrapTracker.markFailed(event.cpf, event.resource);
        if (bootstrapState?.status === 'failed') {
            this.notifier.emitBootstrapFailed(toBootstrapNotification(bootstrapState));
        }

        this.notifier.emitResourceFailed(event);
    }
}

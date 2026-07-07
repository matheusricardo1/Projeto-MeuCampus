import { AcademicBootstrapTracker } from '@academic/application/ports/academic-bootstrap-tracker';
import { AcademicNotificationService, type AcademicResourceNotification } from '@academic/application/ports/academic-notification-service';
import { toBootstrapNotification } from '@academic/application/services/to-bootstrap-notification';

export class HandleAcademicResourceReadyUseCase {
    constructor(
        private readonly bootstrapTracker: AcademicBootstrapTracker,
        private readonly notifier: AcademicNotificationService
    ) {}

    async execute(event: AcademicResourceNotification): Promise<void> {
        this.notifier.emitResourceReady(event);

        const bootstrapState = await this.bootstrapTracker.markReady(event.cpf, event.resource);
        if (bootstrapState?.status === 'ready') {
            this.notifier.emitBootstrapReady(toBootstrapNotification(bootstrapState));
        } else if (bootstrapState?.status === 'failed') {
            // The bootstrap set can complete on a *successful* resource —
            // this one — even though the overall outcome is "failed"
            // because some other required resource failed earlier.
            this.notifier.emitBootstrapFailed(toBootstrapNotification(bootstrapState));
        }
    }
}

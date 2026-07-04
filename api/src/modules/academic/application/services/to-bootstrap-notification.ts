import type { AcademicBootstrapState } from '@academic/application/ports/academic-bootstrap-tracker';
import type { AcademicBootstrapNotification } from '@realtime/application/ports/academic-notification-service';

export function toBootstrapNotification(state: AcademicBootstrapState): AcademicBootstrapNotification {
    return {
        cpf: state.cpf,
        requiredResources: state.requiredResources,
        readyResources: state.readyResources,
        failedResources: state.failedResources
    };
}

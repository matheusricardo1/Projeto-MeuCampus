import type { AcademicResource } from '@academic/domain/value-objects/academic-resource.value-object';

export const ACADEMIC_AUTH_REJECTED_EVENT = 'ecampus:auth-rejected';
export const ACADEMIC_RESOURCE_READY_EVENT = 'ecampus:resource-ready';
export const ACADEMIC_RESOURCE_FAILED_EVENT = 'ecampus:resource-failed';
export const ACADEMIC_BOOTSTRAP_READY_EVENT = 'ecampus:bootstrap-ready';
export const ACADEMIC_BOOTSTRAP_FAILED_EVENT = 'ecampus:bootstrap-failed';

export interface AcademicResourceNotification {
    cpf: string;
    resource: AcademicResource;
    year?: string;
    period?: string;
    planId?: string;
}

export interface AcademicResourceFailedNotification extends AcademicResourceNotification {
    status: 'failed';
    errorName: string;
    message: string;
}

export interface AcademicBootstrapNotification {
    cpf: string;
    requiredResources: AcademicResource[];
    readyResources: AcademicResource[];
    failedResources: AcademicResource[];
}

export abstract class AcademicNotificationService {
    abstract emitResourceReady(event: AcademicResourceNotification): void;
    abstract emitResourceFailed(event: AcademicResourceFailedNotification): void;
    abstract emitBootstrapReady(event: AcademicBootstrapNotification): void;
    abstract emitBootstrapFailed(event: AcademicBootstrapNotification): void;
}

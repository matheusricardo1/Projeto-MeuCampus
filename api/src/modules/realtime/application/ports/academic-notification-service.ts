import type { AcademicResource } from '@academic/domain/value-objects/academic-resource.value-object';

export const ACADEMIC_AUTH_REJECTED_EVENT = 'ecampus:auth-rejected';
export const ACADEMIC_RESOURCE_READY_EVENT = 'ecampus:resource-ready';
export const ACADEMIC_RESOURCE_FAILED_EVENT = 'ecampus:resource-failed';

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

export abstract class AcademicNotificationService {
    abstract emitResourceReady(event: AcademicResourceNotification): void;
    abstract emitResourceFailed(event: AcademicResourceFailedNotification): void;
}

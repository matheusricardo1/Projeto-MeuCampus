import type { AcademicResource } from '@academic/domain/value-objects/academic-resource.value-object';

export const ACADEMIC_SCRAPE_RESULT_CHANNEL = 'ecampus:scrape:result';
export const ACADEMIC_RESOURCE_READY_EVENT = 'ecampus:resource-ready';
export const ACADEMIC_RESOURCE_FAILED_EVENT = 'ecampus:resource-failed';
export const ACADEMIC_AUTH_REJECTED_EVENT = 'ecampus:auth-rejected';

export interface AcademicResourceReadyEvent {
    cpf: string;
    resource: AcademicResource;
    year?: string;
    period?: string;
    planId?: string;
}

export interface AcademicResourceFailedEvent extends AcademicResourceReadyEvent {
    status: 'failed';
    errorName: string;
    message: string;
}

export interface AcademicLoginReadyEvent {
    type: 'login';
    jobId: string;
    cpf: string;
    session: Record<string, unknown>;
}

export interface AcademicLoginFailedEvent {
    type: 'login';
    status: 'failed';
    jobId: string;
    cpf: string;
    errorName: string;
    message: string;
}

export type AcademicScrapeResultEvent =
    | AcademicResourceReadyEvent
    | AcademicResourceFailedEvent
    | AcademicLoginReadyEvent
    | AcademicLoginFailedEvent;

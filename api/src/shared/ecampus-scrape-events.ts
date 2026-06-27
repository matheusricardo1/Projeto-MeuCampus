import type { EcampusCachedResource } from '@/shared/ecampus-cache';

export const ECAMPUS_SCRAPE_RESULT_CHANNEL = 'ecampus:scrape:result';
export const ECAMPUS_RESOURCE_READY_EVENT = 'ecampus:resource-ready';
export const ECAMPUS_RESOURCE_FAILED_EVENT = 'ecampus:resource-failed';

export interface EcampusResourceReadyEvent {
    cpf: string;
    resource: EcampusCachedResource;
    year?: string;
    period?: string;
    planId?: string;
}

export interface EcampusResourceFailedEvent extends EcampusResourceReadyEvent {
    status: 'failed';
    errorName: string;
    message: string;
}

export type EcampusScrapeResultEvent = EcampusResourceReadyEvent | EcampusResourceFailedEvent;

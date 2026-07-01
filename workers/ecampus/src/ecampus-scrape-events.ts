import type { EcampusCachedResource } from './ecampus-cache';

export const ECAMPUS_SCRAPE_RESULT_CHANNEL = 'ecampus:scrape:result';

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

export interface EcampusLoginReadyEvent {
    type: 'login';
    jobId: string;
    cpf: string;
    session: Record<string, unknown>;
}

export interface EcampusLoginFailedEvent {
    type: 'login';
    status: 'failed';
    jobId: string;
    cpf: string;
    errorName: string;
    message: string;
}

export type EcampusScrapeResultEvent =
    | EcampusResourceReadyEvent
    | EcampusResourceFailedEvent
    | EcampusLoginReadyEvent
    | EcampusLoginFailedEvent;

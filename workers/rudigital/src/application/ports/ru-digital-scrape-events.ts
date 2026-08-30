import type { RuDigitalCachedResource } from '@/domain/value-objects/ru-digital-cached-resource';

export interface RuDigitalResourceReadyEvent {
    cpf: string;
    resource: RuDigitalCachedResource;
    date?: string;
}

export interface RuDigitalResourceFailedEvent extends RuDigitalResourceReadyEvent {
    status: 'failed';
    errorName: string;
    message: string;
}

export interface RuDigitalLoginReadyEvent {
    type: 'login';
    jobId: string;
    cpf: string;
    session: Record<string, unknown>;
}

export interface RuDigitalLoginFailedEvent {
    type: 'login';
    status: 'failed';
    jobId: string;
    cpf: string;
    errorName: string;
    message: string;
}

export type RuDigitalScrapeResultEvent =
    | RuDigitalResourceReadyEvent
    | RuDigitalResourceFailedEvent
    | RuDigitalLoginReadyEvent
    | RuDigitalLoginFailedEvent;

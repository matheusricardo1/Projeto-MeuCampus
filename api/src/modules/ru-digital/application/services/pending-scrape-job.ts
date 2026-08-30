import type { RuDigitalResource } from '@ru-digital/domain/value-objects/ru-digital-resource.value-object';

export interface PendingScrapeJob {
    status: 'pending';
    resource: RuDigitalResource;
}

export function pendingScrapeJob(resource: RuDigitalResource): PendingScrapeJob {
    return { status: 'pending', resource };
}

export function isPendingScrapeJob(value: unknown): value is PendingScrapeJob {
    return Boolean(value)
        && typeof value === 'object'
        && (value as PendingScrapeJob).status === 'pending'
        && typeof (value as PendingScrapeJob).resource === 'string';
}

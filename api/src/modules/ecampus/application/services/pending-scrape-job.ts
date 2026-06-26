import type { EcampusCachedResource } from '@/shared/ecampus-cache';

export interface PendingScrapeJob {
    status: 'pending';
    resource: EcampusCachedResource;
}

export function pendingScrapeJob(resource: EcampusCachedResource): PendingScrapeJob {
    return { status: 'pending', resource };
}

export function isPendingScrapeJob(value: unknown): value is PendingScrapeJob {
    return Boolean(value)
        && typeof value === 'object'
        && (value as PendingScrapeJob).status === 'pending'
        && typeof (value as PendingScrapeJob).resource === 'string';
}

import type { AcademicResource } from '@academic/domain/models/academic-resource';

export interface PendingScrapeJob {
    status: 'pending';
    resource: AcademicResource;
}

export function pendingScrapeJob(resource: AcademicResource): PendingScrapeJob {
    return { status: 'pending', resource };
}

export function isPendingScrapeJob(value: unknown): value is PendingScrapeJob {
    return Boolean(value)
        && typeof value === 'object'
        && (value as PendingScrapeJob).status === 'pending'
        && typeof (value as PendingScrapeJob).resource === 'string';
}

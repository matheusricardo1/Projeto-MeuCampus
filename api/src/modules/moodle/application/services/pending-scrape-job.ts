import type { MoodleResource } from '@moodle/domain/value-objects/moodle-resource.value-object';

export interface PendingScrapeJob {
    status: 'pending';
    resource: MoodleResource;
}

export function pendingScrapeJob(resource: MoodleResource): PendingScrapeJob {
    return { status: 'pending', resource };
}

export function isPendingScrapeJob(value: unknown): value is PendingScrapeJob {
    return Boolean(value)
        && typeof value === 'object'
        && (value as PendingScrapeJob).status === 'pending'
        && typeof (value as PendingScrapeJob).resource === 'string';
}

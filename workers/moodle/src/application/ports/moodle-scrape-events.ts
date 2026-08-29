import type { MoodleCachedResource } from '@/domain/value-objects/moodle-cached-resource';

/** `identity` is `"<instanceId>:<username>"` — see application/services/moodle-identity.ts. */
export interface MoodleResourceReadyEvent {
    identity: string;
    resource: MoodleCachedResource;
    extra?: string;
}

export interface MoodleResourceFailedEvent extends MoodleResourceReadyEvent {
    status: 'failed';
    errorName: string;
    message: string;
}

export interface MoodleLoginReadyEvent {
    type: 'login';
    jobId: string;
    identity: string;
    session: Record<string, unknown>;
}

export interface MoodleLoginFailedEvent {
    type: 'login';
    status: 'failed';
    jobId: string;
    identity: string;
    errorName: string;
    message: string;
}

export type MoodleScrapeResultEvent =
    | MoodleResourceReadyEvent
    | MoodleResourceFailedEvent
    | MoodleLoginReadyEvent
    | MoodleLoginFailedEvent;

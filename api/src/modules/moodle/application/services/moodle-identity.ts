import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';

/**
 * Same opaque identity string used on the worker side (see
 * workers/moodle/src/application/services/moodle-identity.ts) — the two
 * codebases must derive it identically since it's the shared Redis key.
 */
export function moodleIdentity(credentials: Pick<MoodleCredentials, 'instanceId' | 'username'>): string {
    return `${credentials.instanceId}:${credentials.username}`;
}

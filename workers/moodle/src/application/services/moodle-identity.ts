import type { MoodleCredentials } from '@/domain/value-objects/moodle-credentials';

/**
 * A single opaque identity string is what every session/cache/event port
 * actually keys on (mirrors how workers/ecampus and workers/rudigital key
 * everything on a bare CPF) — here that identity has to fold in the instance
 * too, since the same username can exist independently on each Moodle site.
 */
export function moodleIdentity(credentials: Pick<MoodleCredentials, 'instanceId' | 'username'>): string {
    return `${credentials.instanceId}:${credentials.username}`;
}

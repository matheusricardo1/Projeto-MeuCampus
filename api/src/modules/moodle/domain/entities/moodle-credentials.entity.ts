import type { MoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';

export interface MoodleCredentials {
    instanceId: MoodleInstanceId;
    username: string;
    /** `{ token, userId }` scraped by the worker, once authenticated. */
    session?: Record<string, unknown>;
}

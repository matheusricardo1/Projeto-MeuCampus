import type { MoodleInstanceId } from '@/config/moodle-instances';

export interface MoodleCredentials {
    instanceId: MoodleInstanceId;
    username: string;
    /** `{ token, userId }` once authenticated — see MoodleAuthService.authenticate. */
    session?: Record<string, unknown>;
}

import type { MoodleCredentials } from '@/domain/value-objects/moodle-credentials';

export interface MoodleAuthenticator {
    /** Logs in and returns the session data to persist (`{ token, userId }`). */
    authenticate(credentials: MoodleCredentials, password: string): Promise<Record<string, unknown>>;
}

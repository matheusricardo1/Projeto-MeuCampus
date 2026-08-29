import type { MoodleCredentials } from '@/domain/value-objects/moodle-credentials';
import type { MoodleInstanceId } from '@/config/moodle-instances';

export const MOODLE_SYNC_QUEUE_NAME = process.env.MOODLE_SYNC_QUEUE || 'moodle-sync';

export type MoodleSyncJobName = 'login' | 'logout' | 'courses' | 'timeline';

export type MoodleSyncJobData =
    | {
        instanceId: MoodleInstanceId;
        username: string;
        password: string;
      }
    | {
        credentials: MoodleCredentials;
      };

/**
 * Wire shape actually stored in BullMQ. Job data always carries a username +
 * password or a session token — both sensitive — so the API encrypts it
 * before enqueueing and the worker decrypts it back into MoodleSyncJobData.
 */
export interface EncryptedMoodleSyncJobData {
    __enc: string;
}

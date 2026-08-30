import type { MoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';

/** A student's linked Moodle account — see MoodleAccountLink in schema.prisma. */
export interface MoodleAccountLink {
    instanceId: MoodleInstanceId;
    username: string;
    linkedAt: Date;
    lastSyncAt: Date | null;
}

/** Internal shape carrying the decrypted password — never returned to the app/AI, only used server-side to re-authenticate. */
export interface MoodleAccountCredentials {
    instanceId: MoodleInstanceId;
    username: string;
    password: string;
}

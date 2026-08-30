import type { MoodleAccountLink } from '@moodle/domain/entities/moodle-account-link.entity';
import type { MoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';

export abstract class MoodleAccountLinkRepository {
    /** Encrypts the password before persisting. */
    abstract link(userId: string, instanceId: MoodleInstanceId, username: string, password: string): Promise<void>;
    abstract unlink(userId: string, instanceId: MoodleInstanceId): Promise<boolean>;
    abstract listByUser(userId: string): Promise<MoodleAccountLink[]>;
    /** Decrypts the password — server-side use only (silent re-auth), never exposed to a caller. */
    abstract findCredentials(userId: string, instanceId: MoodleInstanceId): Promise<{ username: string; password: string } | null>;
    /** The first linked instance for this user, ordered by linkedAt — used when the AI doesn't specify one. */
    abstract findFirstCredentials(userId: string): Promise<{ instanceId: MoodleInstanceId; username: string; password: string } | null>;
}

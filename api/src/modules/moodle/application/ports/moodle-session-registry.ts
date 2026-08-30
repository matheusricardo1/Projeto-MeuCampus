import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';

export abstract class MoodleSessionRegistry {
    abstract activate(credentials: MoodleCredentials): Promise<void>;
    abstract invalidate(identity: string): Promise<void>;
    abstract isActive(credentials: MoodleCredentials): Promise<boolean>;
}

import type { MoodleRepository } from '@/domain/repositories/moodle.repository';
import type { MoodleCacheStore } from '@/application/ports/moodle-cache-store';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';
import type { MoodleCredentials } from '@/domain/value-objects/moodle-credentials';
import { moodleIdentity } from '@/application/services/moodle-identity';

export class LogoutMoodleSessionUseCase {
    constructor(
        private readonly repository: MoodleRepository,
        private readonly cache: MoodleCacheStore,
        private readonly sessions: MoodleSessionStore
    ) {}

    async execute(credentials: MoodleCredentials): Promise<{ cacheDeletedKeys: number; externalLogout: 'ok' | 'failed' }> {
        let externalLogout: 'ok' | 'failed' = 'ok';
        const identity = moodleIdentity(credentials);

        try {
            await this.repository.logout(credentials);
        } catch {
            externalLogout = 'failed';
        }

        const cacheDeletedKeys = await this.cache.clearUserCache(identity);
        await this.sessions.markInvalid(identity, 'logout');
        return { cacheDeletedKeys, externalLogout };
    }
}

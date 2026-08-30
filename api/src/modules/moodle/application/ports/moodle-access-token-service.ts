import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';

/**
 * Own, independent token service — deliberately not merged into the
 * eCampus/academic AccessTokenService (or RU Digital's) so this integration
 * can't affect the auth path every other authenticated request already
 * depends on.
 */
export abstract class MoodleAccessTokenService {
    abstract sign(credentials: MoodleCredentials): string;
    abstract verify(token: string): MoodleCredentials;
}

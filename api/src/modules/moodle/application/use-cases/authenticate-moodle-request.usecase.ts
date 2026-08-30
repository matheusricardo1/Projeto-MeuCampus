import { MoodleAccessTokenService } from '@moodle/application/ports/moodle-access-token-service';
import { MoodleSessionRegistry } from '@moodle/application/ports/moodle-session-registry';
import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';

export class AuthenticateMoodleRequestUseCase {
    constructor(
        private readonly accessTokenService: MoodleAccessTokenService,
        private readonly sessionRegistry: MoodleSessionRegistry
    ) {}

    async execute(token: string): Promise<MoodleCredentials> {
        const credentials = this.accessTokenService.verify(token);
        const isActive = await this.sessionRegistry.isActive(credentials);
        if (!isActive) {
            throw new Error('Moodle session is not active.');
        }

        return credentials;
    }
}

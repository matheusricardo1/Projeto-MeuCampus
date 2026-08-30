import { RuDigitalAccessTokenService } from '@ru-digital/application/ports/ru-digital-access-token-service';
import { RuDigitalSessionRegistry } from '@ru-digital/application/ports/ru-digital-session-registry';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';

export class AuthenticateRuDigitalRequestUseCase {
    constructor(
        private readonly accessTokenService: RuDigitalAccessTokenService,
        private readonly sessionRegistry: RuDigitalSessionRegistry
    ) {}

    async execute(token: string): Promise<RuDigitalCredentials> {
        const credentials = this.accessTokenService.verify(token);
        const isActive = await this.sessionRegistry.isActive(credentials);
        if (!isActive) {
            throw new Error('RU Digital session is not active.');
        }

        return credentials;
    }
}

import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';

export class AuthenticateAcademicRequestUseCase {
    constructor(
        private readonly accessTokenService: AccessTokenService,
        private readonly sessionRegistry: AcademicSessionRegistry
    ) {}

    async execute(token: string): Promise<AcademicCredentials> {
        const credentials = this.accessTokenService.verify(token);
        const isActive = await this.sessionRegistry.isActive(credentials);
        if (!isActive) {
            throw new Error('Academic session is not active.');
        }

        return credentials;
    }
}

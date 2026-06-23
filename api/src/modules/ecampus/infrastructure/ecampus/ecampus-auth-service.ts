import type { EcampusAuthenticator } from '@ecampus/application/ports/ecampus-authenticator';
import { AuthenticationError } from '@ecampus/domain/errors/authentication.error';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import { EcampusClient } from '@ecampus/infrastructure/ecampus/ecampus-client';
import { logger } from '@ecampus/infrastructure/logging/console-logger';

export class EcampusAuthService implements EcampusAuthenticator {
    authenticate(credentials: EcampusCredentials, password: string): Promise<Record<string, unknown>> {
        return this.loginAndExportSession(credentials.cpf, password);
    }

    private async loginAndExportSession(cpf: string, password: string): Promise<Record<string, unknown>> {
        const client = new EcampusClient();
        await client.login(cpf, password);
        return client.exportCookies();
    }

    async logout(credentials: EcampusCredentials): Promise<void> {
        if (!credentials.session) {
            logger.info("No eCampus session found in token payload.");
            return;
        }

        const client = new EcampusClient();
        client.importCookies(credentials.session);

        await client.logout();
    }

    async getAuthenticatedClient(credentials: EcampusCredentials): Promise<EcampusClient> {
        if (!credentials.session) {
            throw new AuthenticationError("eCampus session missing from token payload.");
        }

        let client = new EcampusClient();
        client.importCookies(credentials.session);

        if (await client.isSessionAlive()) {
            return client;
        }

        logger.info("Session expired. User must authenticate again.");
        throw new AuthenticationError("eCampus session expired. Please sign in again.");
    }
}

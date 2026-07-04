import { AuthenticationError } from '@/domain/exceptions/authentication.error';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import { EcampusClient } from '@/infrastructure/ecampus-portal/ecampus-client';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';
import type { EcampusAuthenticator } from '@/application/ports/ecampus-authenticator';

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
            throw new AuthenticationError('Sua sessao nao foi encontrada. Entre novamente.');
        }

        const client = new EcampusClient();
        client.importCookies(credentials.session);
        return client;
    }
}

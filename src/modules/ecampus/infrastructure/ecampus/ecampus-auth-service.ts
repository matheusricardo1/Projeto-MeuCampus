import type { CredentialVault } from '@ecampus/application/ports/credential-vault';
import type { EcampusAuthenticator } from '@ecampus/application/ports/ecampus-authenticator';
import type { SessionStore } from '@ecampus/application/ports/session-store';
import { AuthenticationError } from '@ecampus/domain/errors/authentication.error';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import { EcampusClient } from '@ecampus/infrastructure/ecampus/ecampus-client';
import { logger } from '@ecampus/infrastructure/logging/console-logger';

export class EcampusAuthService implements EcampusAuthenticator {
    constructor(
        private readonly sessionStore: SessionStore,
        private readonly credentialVault: CredentialVault
    ) {}

    async authenticate(credentials: EcampusCredentials): Promise<void> {
        await this.getAuthenticatedClient(credentials);
    }

    async logout(credentials: EcampusCredentials): Promise<void> {
        const savedCookies = await this.sessionStore.getSession(credentials.cpf);

        if (!savedCookies) {
            logger.info(`No saved eCampus session found for ${credentials.cpf}.`);
            return;
        }

        const client = new EcampusClient();
        client.importCookies(savedCookies);

        try {
            await client.logout();
        } finally {
            await this.sessionStore.deleteSession(credentials.cpf);
        }
    }

    async getAuthenticatedClient(credentials: EcampusCredentials): Promise<EcampusClient> {
        let client = new EcampusClient();
        const savedCookies = await this.sessionStore.getSession(credentials.cpf);

        if (savedCookies) {
            client.importCookies(savedCookies);
        }

        if (await client.isSessionAlive()) {
            return client;
        }

        if (savedCookies) {
            await this.sessionStore.deleteSession(credentials.cpf);
            client = new EcampusClient();
        }

        logger.info(`Session expired for ${credentials.cpf}. Initiating silent recovery...`);

        if (!credentials.encryptedPassword) {
            throw new AuthenticationError("No encrypted password provided for silent recovery.");
        }

        let realPassword = this.credentialVault.decryptPassword(credentials.encryptedPassword);
        await client.login(credentials.cpf, realPassword);
        realPassword = "CLEARED";

        await this.sessionStore.saveSession(credentials.cpf, client.exportCookies());
        return client;
    }
}

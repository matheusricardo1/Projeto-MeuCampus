import { AuthenticationError } from '@/domain/exceptions/authentication.error';
import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';
import { RuDigitalClient } from '@/infrastructure/ru-digital-portal/ru-digital-client';
import type { RuDigitalActionResolver } from '@/infrastructure/ru-digital-portal/ru-digital-action-resolver';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';
import type { RuDigitalAuthenticator } from '@/application/ports/ru-digital-authenticator';

export class RuDigitalAuthService implements RuDigitalAuthenticator {
    constructor(private readonly resolver: RuDigitalActionResolver) {}

    async authenticate(credentials: RuDigitalCredentials, password: string): Promise<Record<string, unknown>> {
        const client = new RuDigitalClient(this.resolver);
        await client.login(credentials.cpf, password);
        return { ...client.exportSession() };
    }

    async logout(credentials: RuDigitalCredentials): Promise<void> {
        if (!credentials.token) {
            logger.info('No RU Digital session found in token payload.');
            return;
        }

        const client = new RuDigitalClient(this.resolver);
        client.importSession(this.toSession(credentials.token, credentials.restaurantId));
        await client.logout();
    }

    getAuthenticatedClient(credentials: RuDigitalCredentials): RuDigitalClient {
        if (!credentials.token) {
            throw new AuthenticationError('Sua sessao do RU Digital nao foi encontrada. Entre novamente.');
        }

        const client = new RuDigitalClient(this.resolver);
        client.importSession(this.toSession(credentials.token, credentials.restaurantId));
        return client;
    }

    private toSession(token: string, restaurantId?: string): { token: string; restaurantId?: string } {
        return restaurantId ? { token, restaurantId } : { token };
    }
}

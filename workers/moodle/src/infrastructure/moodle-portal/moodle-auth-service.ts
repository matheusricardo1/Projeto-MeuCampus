import { AuthenticationError } from '@/domain/exceptions/authentication.error';
import type { MoodleCredentials } from '@/domain/value-objects/moodle-credentials';
import { MoodleClient } from '@/infrastructure/moodle-portal/moodle-client';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';
import type { MoodleAuthenticator } from '@/application/ports/moodle-authenticator';

export class MoodleAuthService implements MoodleAuthenticator {
    async authenticate(credentials: MoodleCredentials, password: string): Promise<Record<string, unknown>> {
        const client = new MoodleClient(credentials.instanceId);
        await client.login(credentials.username, password);

        // core_webservice_get_site_info enumerates every installed plugin to
        // report the userid, and it's known to be broken on at least one
        // instance (ColabWeb has a plugin missing its version.php) — resolve
        // the userid independently instead of depending on that call.
        const users = await client.call<Array<{ id: number }>>('core_user_get_users_by_field', {
            field: 'username',
            'values[0]': credentials.username
        });

        const userId = users[0]?.id;
        if (!userId) {
            throw new AuthenticationError('Nao foi possivel identificar o usuario no Moodle.');
        }

        const session = client.exportSession();
        return { token: session.token, userId };
    }

    async logout(credentials: MoodleCredentials): Promise<void> {
        if (!credentials.session) {
            logger.info('No Moodle session found in credentials payload.');
        }
        // See MoodleClient.logout — nothing server-side to call for a
        // student-scoped mobile token.
    }

    getAuthenticatedClient(credentials: MoodleCredentials): MoodleClient {
        const token = credentials.session?.token;
        if (typeof token !== 'string') {
            throw new AuthenticationError('Sua sessao do Moodle nao foi encontrada. Entre novamente.');
        }

        const client = new MoodleClient(credentials.instanceId);
        client.importSession({ token });
        return client;
    }
}

import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';

export interface EcampusAuthenticator {
    authenticate(credentials: EcampusCredentials): Promise<void>;
}

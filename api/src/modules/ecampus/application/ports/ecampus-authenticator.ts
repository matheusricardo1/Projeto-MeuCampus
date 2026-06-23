import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';

export interface EcampusAuthenticator {
    authenticate(credentials: EcampusCredentials, password: string): Promise<void>;
}

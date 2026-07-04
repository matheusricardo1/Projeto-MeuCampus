import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';

export interface EcampusAuthenticator {
    authenticate(credentials: EcampusCredentials, password: string): Promise<Record<string, unknown>>;
}

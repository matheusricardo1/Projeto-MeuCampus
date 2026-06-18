import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';

export interface AccessTokenService {
    sign(credentials: EcampusCredentials): string;
    verify(token: string): EcampusCredentials;
}

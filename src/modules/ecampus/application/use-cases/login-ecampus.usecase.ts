import type { AccessTokenService } from '@ecampus/application/ports/access-token-service';
import type { CredentialVault } from '@ecampus/application/ports/credential-vault';
import type { EcampusAuthenticator } from '@ecampus/application/ports/ecampus-authenticator';

export interface LoginEcampusInput {
    user: string;
    password: string;
}

export interface LoginEcampusOutput {
    accessToken: string;
    tokenType: 'Bearer';
}

export class LoginEcampusUseCase {
    constructor(
        private readonly credentialVault: CredentialVault,
        private readonly ecampusAuthenticator: EcampusAuthenticator,
        private readonly accessTokenService: AccessTokenService
    ) {}

    async execute(input: LoginEcampusInput): Promise<LoginEcampusOutput> {
        const credentials = {
            cpf: input.user,
            encryptedPassword: this.credentialVault.encryptPassword(input.password)
        };

        await this.ecampusAuthenticator.authenticate(credentials);

        return {
            accessToken: this.accessTokenService.sign(credentials),
            tokenType: 'Bearer'
        };
    }
}

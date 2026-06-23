import type { AccessTokenService } from '@ecampus/application/ports/access-token-service';
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
        private readonly ecampusAuthenticator: EcampusAuthenticator,
        private readonly accessTokenService: AccessTokenService
    ) {}

    async execute(input: LoginEcampusInput): Promise<LoginEcampusOutput> {
        const credentials = {
            cpf: input.user
        };

        await this.ecampusAuthenticator.authenticate(credentials, input.password);

        return {
            accessToken: this.accessTokenService.sign(credentials),
            tokenType: 'Bearer'
        };
    }
}

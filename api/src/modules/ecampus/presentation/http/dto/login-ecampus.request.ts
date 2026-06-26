import { EcampusRequestValidator } from '@ecampus/presentation/http/validators/ecampus-request.validator';

export class LoginEcampusRequest {
    constructor(
        public readonly user?: string,
        public readonly password?: string
    ) {}

    toCredentialsInput() {
        return {
            user: EcampusRequestValidator.parseCpf(this.user),
            password: EcampusRequestValidator.parsePassword(this.password)
        };
    }
}

import { AcademicRequestValidator } from '@academic/presentation/http/validators/academic-request.validator';

export class LoginAcademicRequest {
    constructor(
        public readonly user?: string,
        public readonly password?: string
    ) {}

    toCredentialsInput() {
        return {
            user: AcademicRequestValidator.parseCpf(this.user),
            password: AcademicRequestValidator.parsePassword(this.password)
        };
    }
}

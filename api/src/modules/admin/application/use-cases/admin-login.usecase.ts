import { AdminJwtService } from '@admin/infrastructure/security/admin-jwt.service';
import { constantTimeEqual } from '@admin/infrastructure/security/timing-safe-equal';
import { InvalidAdminCredentialsException } from '@admin/domain/exceptions/invalid-admin-credentials.exception';

export interface AdminLoginInput {
    email: string;
    password: string;
}

export interface AdminLoginOutput {
    accessToken: string;
}

export class AdminLoginUseCase {
    constructor(private readonly adminJwtService: AdminJwtService) {}

    execute(input: AdminLoginInput): AdminLoginOutput {
        const expectedEmail = process.env.ADMIN_EMAIL;
        const expectedPassword = process.env.ADMIN_PASSWORD;

        if (!expectedEmail || !expectedPassword) {
            throw new Error('CRITICAL: ADMIN_EMAIL and ADMIN_PASSWORD must be configured.');
        }

        const emailMatches = constantTimeEqual(input.email.trim().toLowerCase(), expectedEmail.trim().toLowerCase());
        const passwordMatches = constantTimeEqual(input.password, expectedPassword);

        if (!emailMatches || !passwordMatches) {
            throw new InvalidAdminCredentialsException();
        }

        return { accessToken: this.adminJwtService.sign(expectedEmail) };
    }
}

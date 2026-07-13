import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLoginUseCase } from '@admin/application/use-cases/admin-login.usecase';
import { InvalidAdminCredentialsException } from '@admin/domain/exceptions/invalid-admin-credentials.exception';
import type { AdminJwtService } from '@admin/infrastructure/security/admin-jwt.service';

const ORIGINAL_EMAIL = process.env.ADMIN_EMAIL;
const ORIGINAL_PASSWORD = process.env.ADMIN_PASSWORD;

function buildUseCase(): { adminJwtService: AdminJwtService; useCase: AdminLoginUseCase } {
    const adminJwtService = { sign: vi.fn().mockReturnValue('signed-token') } as unknown as AdminJwtService;
    return { adminJwtService, useCase: new AdminLoginUseCase(adminJwtService) };
}

describe('AdminLoginUseCase', () => {
    beforeEach(() => {
        process.env.ADMIN_EMAIL = 'owner@example.com';
        process.env.ADMIN_PASSWORD = 'super-secret-password';
    });

    afterEach(() => {
        if (ORIGINAL_EMAIL === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = ORIGINAL_EMAIL;
        if (ORIGINAL_PASSWORD === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = ORIGINAL_PASSWORD;
    });

    it('signs and returns an access token for the correct email/password', () => {
        const { adminJwtService, useCase } = buildUseCase();

        const result = useCase.execute({ email: 'owner@example.com', password: 'super-secret-password' });

        expect(result).toEqual({ accessToken: 'signed-token' });
        expect(adminJwtService.sign).toHaveBeenCalledWith('owner@example.com');
    });

    it('is case-insensitive and trims whitespace on the email', () => {
        const { useCase } = buildUseCase();
        expect(() => useCase.execute({ email: '  OWNER@Example.com  ', password: 'super-secret-password' })).not.toThrow();
    });

    it('rejects a wrong password', () => {
        const { useCase } = buildUseCase();
        expect(() => useCase.execute({ email: 'owner@example.com', password: 'wrong' })).toThrow(InvalidAdminCredentialsException);
    });

    it('rejects a wrong email', () => {
        const { useCase } = buildUseCase();
        expect(() => useCase.execute({ email: 'someone-else@example.com', password: 'super-secret-password' })).toThrow(InvalidAdminCredentialsException);
    });

    it('does not sign a token when credentials are wrong', () => {
        const { adminJwtService, useCase } = buildUseCase();
        expect(() => useCase.execute({ email: 'wrong@example.com', password: 'wrong' })).toThrow();
        expect(adminJwtService.sign).not.toHaveBeenCalled();
    });

    it('throws a configuration error when ADMIN_EMAIL/ADMIN_PASSWORD are not set', () => {
        delete process.env.ADMIN_EMAIL;
        delete process.env.ADMIN_PASSWORD;
        const { useCase } = buildUseCase();

        expect(() => useCase.execute({ email: 'owner@example.com', password: 'super-secret-password' }))
            .toThrow('CRITICAL: ADMIN_EMAIL and ADMIN_PASSWORD must be configured.');
    });
});

import { describe, expect, it, vi } from 'vitest';
import { AuthenticateRuDigitalRequestUseCase } from '@ru-digital/application/use-cases/authenticate-ru-digital-request.usecase';
import type { RuDigitalAccessTokenService } from '@ru-digital/application/ports/ru-digital-access-token-service';
import type { RuDigitalSessionRegistry } from '@ru-digital/application/ports/ru-digital-session-registry';

const CREDENTIALS = { cpf: '06124555212', session: { token: 'jwt' } };

describe('AuthenticateRuDigitalRequestUseCase', () => {
    it('returns the verified credentials when the session is active', async () => {
        const accessTokenService = { verify: vi.fn().mockReturnValue(CREDENTIALS), sign: vi.fn() } as unknown as RuDigitalAccessTokenService;
        const sessionRegistry = { isActive: vi.fn().mockResolvedValue(true), activate: vi.fn(), invalidate: vi.fn() } as unknown as RuDigitalSessionRegistry;

        const useCase = new AuthenticateRuDigitalRequestUseCase(accessTokenService, sessionRegistry);
        const result = await useCase.execute('a-valid-token');

        expect(accessTokenService.verify).toHaveBeenCalledWith('a-valid-token');
        expect(sessionRegistry.isActive).toHaveBeenCalledWith(CREDENTIALS);
        expect(result).toBe(CREDENTIALS);
    });

    it('throws when the session registry reports the session is not active', async () => {
        const accessTokenService = { verify: vi.fn().mockReturnValue(CREDENTIALS), sign: vi.fn() } as unknown as RuDigitalAccessTokenService;
        const sessionRegistry = { isActive: vi.fn().mockResolvedValue(false), activate: vi.fn(), invalidate: vi.fn() } as unknown as RuDigitalSessionRegistry;

        const useCase = new AuthenticateRuDigitalRequestUseCase(accessTokenService, sessionRegistry);

        await expect(useCase.execute('a-stale-token')).rejects.toThrow('RU Digital session is not active.');
    });

    it('propagates a token verification failure (invalid/expired/tampered JWT)', async () => {
        const accessTokenService = { verify: vi.fn().mockImplementation(() => { throw new Error('jwt malformed'); }), sign: vi.fn() } as unknown as RuDigitalAccessTokenService;
        const sessionRegistry = { isActive: vi.fn(), activate: vi.fn(), invalidate: vi.fn() } as unknown as RuDigitalSessionRegistry;

        const useCase = new AuthenticateRuDigitalRequestUseCase(accessTokenService, sessionRegistry);

        await expect(useCase.execute('garbage')).rejects.toThrow('jwt malformed');
        expect(sessionRegistry.isActive).not.toHaveBeenCalled();
    });
});

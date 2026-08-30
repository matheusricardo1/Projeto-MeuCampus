import { describe, expect, it, vi } from 'vitest';
import { AuthenticateMoodleRequestUseCase } from '@moodle/application/use-cases/authenticate-moodle-request.usecase';
import type { MoodleAccessTokenService } from '@moodle/application/ports/moodle-access-token-service';
import type { MoodleSessionRegistry } from '@moodle/application/ports/moodle-session-registry';

const CREDENTIALS = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1', session: { token: 'wstoken-abc' } };

describe('AuthenticateMoodleRequestUseCase', () => {
    it('returns the verified credentials when the session is active', async () => {
        const accessTokenService = { sign: vi.fn(), verify: vi.fn().mockReturnValue(CREDENTIALS) } as unknown as MoodleAccessTokenService;
        const sessions = { activate: vi.fn(), invalidate: vi.fn(), isActive: vi.fn().mockResolvedValue(true) } as unknown as MoodleSessionRegistry;

        const useCase = new AuthenticateMoodleRequestUseCase(accessTokenService, sessions);
        const result = await useCase.execute('a-valid-jwt');

        expect(accessTokenService.verify).toHaveBeenCalledWith('a-valid-jwt');
        expect(sessions.isActive).toHaveBeenCalledWith(CREDENTIALS);
        expect(result).toBe(CREDENTIALS);
    });

    it('rejects when the token verifies but the session is not active', async () => {
        const accessTokenService = { sign: vi.fn(), verify: vi.fn().mockReturnValue(CREDENTIALS) } as unknown as MoodleAccessTokenService;
        const sessions = { activate: vi.fn(), invalidate: vi.fn(), isActive: vi.fn().mockResolvedValue(false) } as unknown as MoodleSessionRegistry;

        const useCase = new AuthenticateMoodleRequestUseCase(accessTokenService, sessions);

        await expect(useCase.execute('a-stale-jwt')).rejects.toThrow('Moodle session is not active.');
    });

    it('propagates a token verification failure without checking the session', async () => {
        const accessTokenService = { sign: vi.fn(), verify: vi.fn().mockImplementation(() => { throw new Error('jwt malformed'); }) } as unknown as MoodleAccessTokenService;
        const sessions = { activate: vi.fn(), invalidate: vi.fn(), isActive: vi.fn() } as unknown as MoodleSessionRegistry;

        const useCase = new AuthenticateMoodleRequestUseCase(accessTokenService, sessions);

        await expect(useCase.execute('garbage')).rejects.toThrow('jwt malformed');
        expect(sessions.isActive).not.toHaveBeenCalled();
    });
});

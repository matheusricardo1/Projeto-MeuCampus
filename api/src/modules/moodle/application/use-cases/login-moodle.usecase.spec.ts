import { describe, expect, it, vi } from 'vitest';
import { LoginMoodleUseCase } from '@moodle/application/use-cases/login-moodle.usecase';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { MoodleAccessTokenService } from '@moodle/application/ports/moodle-access-token-service';
import type { MoodleSessionRegistry } from '@moodle/application/ports/moodle-session-registry';

describe('LoginMoodleUseCase', () => {
    it('waits for the login job, activates the session, and signs a token', async () => {
        const session = { token: 'wstoken-abc', userId: 140 };
        const waitUntilFinished = vi.fn().mockResolvedValue({ session });
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished }) } as unknown as ScrapingJobService;
        const accessTokenService = { sign: vi.fn().mockReturnValue('signed-access-token') } as unknown as MoodleAccessTokenService;
        const sessions = { activate: vi.fn(), invalidate: vi.fn(), isActive: vi.fn() } as unknown as MoodleSessionRegistry;

        const useCase = new LoginMoodleUseCase(scrapingJobService, accessTokenService, sessions);
        const result = await useCase.execute({ instanceId: 'icomp-colab', username: 'matheusricardo1', password: 'secret' });

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('login', { instanceId: 'icomp-colab', username: 'matheusricardo1', password: 'secret' });
        expect(sessions.activate).toHaveBeenCalledWith({ instanceId: 'icomp-colab', username: 'matheusricardo1', session });
        expect(accessTokenService.sign).toHaveBeenCalledWith({ instanceId: 'icomp-colab', username: 'matheusricardo1', session });
        expect(result).toEqual({ accessToken: 'signed-access-token' });
    });

    it('propagates a login failure without activating a session or signing a token', async () => {
        const waitUntilFinished = vi.fn().mockRejectedValue(new Error('Identificacao ou senha invalidas.'));
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished }) } as unknown as ScrapingJobService;
        const accessTokenService = { sign: vi.fn() } as unknown as MoodleAccessTokenService;
        const sessions = { activate: vi.fn(), invalidate: vi.fn(), isActive: vi.fn() } as unknown as MoodleSessionRegistry;

        const useCase = new LoginMoodleUseCase(scrapingJobService, accessTokenService, sessions);

        await expect(useCase.execute({ instanceId: 'icomp-colab', username: 'matheusricardo1', password: 'wrong' })).rejects.toThrow('Identificacao ou senha invalidas.');
        expect(sessions.activate).not.toHaveBeenCalled();
        expect(accessTokenService.sign).not.toHaveBeenCalled();
    });
});

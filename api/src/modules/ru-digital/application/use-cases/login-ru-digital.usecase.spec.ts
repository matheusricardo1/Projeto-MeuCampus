import { describe, expect, it, vi } from 'vitest';
import { LoginRuDigitalUseCase } from '@ru-digital/application/use-cases/login-ru-digital.usecase';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { RuDigitalAccessTokenService } from '@ru-digital/application/ports/ru-digital-access-token-service';
import type { RuDigitalSessionRegistry } from '@ru-digital/application/ports/ru-digital-session-registry';

describe('LoginRuDigitalUseCase', () => {
    it('waits for the login job, activates the session, and signs a token', async () => {
        const session = { token: 'jwt-from-rudigital' };
        const waitUntilFinished = vi.fn().mockResolvedValue({ session });
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished }) } as unknown as ScrapingJobService;
        const accessTokenService = { sign: vi.fn().mockReturnValue('signed-access-token') } as unknown as RuDigitalAccessTokenService;
        const sessions = { activate: vi.fn() } as unknown as RuDigitalSessionRegistry;

        const useCase = new LoginRuDigitalUseCase(scrapingJobService, accessTokenService, sessions);
        const result = await useCase.execute({ cpf: '06124555212', password: 'secret' });

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('login', { cpf: '06124555212', password: 'secret' });
        expect(sessions.activate).toHaveBeenCalledWith({ cpf: '06124555212', session });
        expect(accessTokenService.sign).toHaveBeenCalledWith({ cpf: '06124555212', session });
        expect(result).toEqual({ accessToken: 'signed-access-token' });
    });

    it('propagates a login failure without activating a session or signing a token', async () => {
        const waitUntilFinished = vi.fn().mockRejectedValue(new Error('CPF ou senha invalidos.'));
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished }) } as unknown as ScrapingJobService;
        const accessTokenService = { sign: vi.fn() } as unknown as RuDigitalAccessTokenService;
        const sessions = { activate: vi.fn() } as unknown as RuDigitalSessionRegistry;

        const useCase = new LoginRuDigitalUseCase(scrapingJobService, accessTokenService, sessions);

        await expect(useCase.execute({ cpf: '06124555212', password: 'wrong' })).rejects.toThrow('CPF ou senha invalidos.');
        expect(sessions.activate).not.toHaveBeenCalled();
        expect(accessTokenService.sign).not.toHaveBeenCalled();
    });
});

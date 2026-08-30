import { describe, expect, it, vi } from 'vitest';
import { SelectRestaurantUseCase } from '@ru-digital/application/use-cases/select-restaurant.usecase';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { RuDigitalAccessTokenService } from '@ru-digital/application/ports/ru-digital-access-token-service';
import type { RuDigitalSessionRegistry } from '@ru-digital/application/ports/ru-digital-session-registry';

const CREDENTIALS = { cpf: '06124555212', session: { token: 'old-jwt' } };

describe('SelectRestaurantUseCase', () => {
    it('waits for the select-restaurant job, activates the updated session, and re-signs a token', async () => {
        const updatedSession = { token: 'old-jwt', restaurantId: 'MAO' };
        const waitUntilFinished = vi.fn().mockResolvedValue({ session: updatedSession });
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished }) } as unknown as ScrapingJobService;
        const accessTokenService = { sign: vi.fn().mockReturnValue('new-access-token'), verify: vi.fn() } as unknown as RuDigitalAccessTokenService;
        const sessions = { activate: vi.fn(), invalidate: vi.fn(), isActive: vi.fn() } as unknown as RuDigitalSessionRegistry;

        const useCase = new SelectRestaurantUseCase(scrapingJobService, accessTokenService, sessions);
        const result = await useCase.execute(CREDENTIALS, 'MAO');

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('select-restaurant', { credentials: CREDENTIALS, restaurantId: 'MAO' });
        expect(sessions.activate).toHaveBeenCalledWith({ cpf: CREDENTIALS.cpf, session: updatedSession });
        expect(accessTokenService.sign).toHaveBeenCalledWith({ cpf: CREDENTIALS.cpf, session: updatedSession });
        expect(result).toEqual({ accessToken: 'new-access-token' });
    });

    it('propagates a job failure (e.g. RU Digital rejected the restaurant) without activating a session or signing a token', async () => {
        const waitUntilFinished = vi.fn().mockRejectedValue(new Error('RU Digital returned HTTP 500.'));
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished }) } as unknown as ScrapingJobService;
        const accessTokenService = { sign: vi.fn(), verify: vi.fn() } as unknown as RuDigitalAccessTokenService;
        const sessions = { activate: vi.fn(), invalidate: vi.fn(), isActive: vi.fn() } as unknown as RuDigitalSessionRegistry;

        const useCase = new SelectRestaurantUseCase(scrapingJobService, accessTokenService, sessions);

        await expect(useCase.execute(CREDENTIALS, 'MAO')).rejects.toThrow('RU Digital returned HTTP 500.');
        expect(sessions.activate).not.toHaveBeenCalled();
        expect(accessTokenService.sign).not.toHaveBeenCalled();
    });
});

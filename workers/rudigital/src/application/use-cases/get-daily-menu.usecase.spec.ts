import { describe, expect, it, vi } from 'vitest';
import { GetDailyMenuUseCase } from '@/application/use-cases/get-daily-menu.usecase';
import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

const CREDENTIALS = { cpf: '06124555212', token: 'jwt' };
const DATE = '2026-08-28';

describe('GetDailyMenuUseCase', () => {
    it('asserts the session is active, then runs the fetch through cache-and-publish for the "cardapio" resource, threading the date', async () => {
        const menu = { date: DATE, restaurantId: 'MAO', mealId: '', items: [] };
        const repository = { getDailyMenu: vi.fn().mockResolvedValue(menu) } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
        const cacheAndPublish = { run: vi.fn().mockImplementation((_resource, _cpf, promise) => promise) } as unknown as CacheAndPublishScrapedResource;

        const useCase = new GetDailyMenuUseCase(repository, sessions, cacheAndPublish);
        const result = await useCase.execute(CREDENTIALS, DATE);

        expect(sessions.assertActive).toHaveBeenCalledWith(CREDENTIALS.cpf);
        expect(cacheAndPublish.run).toHaveBeenCalledWith('cardapio', CREDENTIALS.cpf, expect.any(Promise), DATE);
        expect(repository.getDailyMenu).toHaveBeenCalledWith(CREDENTIALS, DATE);
        expect(result).toBe(menu);
    });

    it('propagates a session-invalidated error without calling the repository', async () => {
        const repository = { getDailyMenu: vi.fn() } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn().mockRejectedValue(new Error('expired')), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
        const cacheAndPublish = { run: vi.fn() } as unknown as CacheAndPublishScrapedResource;

        const useCase = new GetDailyMenuUseCase(repository, sessions, cacheAndPublish);

        await expect(useCase.execute(CREDENTIALS, DATE)).rejects.toThrow('expired');
        expect(repository.getDailyMenu).not.toHaveBeenCalled();
    });
});

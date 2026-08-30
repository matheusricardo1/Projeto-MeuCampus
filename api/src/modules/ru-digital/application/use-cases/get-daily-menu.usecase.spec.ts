import { describe, expect, it, vi } from 'vitest';
import { GetDailyMenuUseCase } from '@ru-digital/application/use-cases/get-daily-menu.usecase';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '06124555212' };
const DATE = '2026-08-28';

function buildDeps() {
    const cache = { getDailyMenu: vi.fn() } as unknown as RuDigitalDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetDailyMenuUseCase', () => {
    it('returns the cached menu for the requested date', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const menu = { date: DATE, restaurantId: 'MAO', mealId: '', items: [] };
        (cache.getDailyMenu as any).mockResolvedValue(menu);

        const useCase = new GetDailyMenuUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS, DATE);

        expect(result).toBe(menu);
        expect(cache.getDailyMenu).toHaveBeenCalledWith(CREDENTIALS.cpf, DATE);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a daily-menu scrape for the given date and returns a pending job on a cache miss', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getDailyMenu as any).mockRejectedValue(new RuDigitalResourceNotFoundException('daily-menu'));

        const useCase = new GetDailyMenuUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS, DATE);

        expect(result).toEqual({ status: 'pending', resource: 'daily-menu' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'daily-menu',
            { credentials: CREDENTIALS, date: DATE },
            { dedupeKey: `ru-digital-06124555212-ru-digital-daily-menu-${DATE}` }
        );
    });

    it('propagates unexpected errors without enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getDailyMenu as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetDailyMenuUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS, DATE)).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

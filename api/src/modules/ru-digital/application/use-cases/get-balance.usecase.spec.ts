import { describe, expect, it, vi } from 'vitest';
import { GetBalanceUseCase } from '@ru-digital/application/use-cases/get-balance.usecase';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '06124555212' };

function buildDeps() {
    const cache = { getBalance: vi.fn() } as unknown as RuDigitalDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetBalanceUseCase', () => {
    it('returns the cached balance when present', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const balance = {
            breakfast: { mealPrice: 0.75, currentBalance: 0, availableForPurchase: 26 },
            lunch: { mealPrice: 1.3, currentBalance: 0, availableForPurchase: 26 },
            dinner: { mealPrice: 1.4, currentBalance: 0, availableForPurchase: 26 }
        };
        (cache.getBalance as any).mockResolvedValue(balance);

        const useCase = new GetBalanceUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toBe(balance);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a balance scrape and returns a pending job when the cache misses', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getBalance as any).mockRejectedValue(new RuDigitalResourceNotFoundException('balance'));

        const useCase = new GetBalanceUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ status: 'pending', resource: 'balance' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'balance',
            { credentials: CREDENTIALS },
            { dedupeKey: 'ru-digital-06124555212-ru-digital-balance' }
        );
    });

    it('propagates unexpected errors without enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getBalance as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetBalanceUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

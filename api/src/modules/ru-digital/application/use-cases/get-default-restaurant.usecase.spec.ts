import { describe, expect, it, vi } from 'vitest';
import { GetDefaultRestaurantUseCase } from '@ru-digital/application/use-cases/get-default-restaurant.usecase';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '06124555212' };

function buildDeps() {
    const cache = { getDefaultRestaurant: vi.fn() } as unknown as RuDigitalDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetDefaultRestaurantUseCase', () => {
    it('returns the cached default restaurant when present', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const restaurant = { id: 'MAO', name: 'Manaus - Campus Coroado', city: 'Manaus - Campus Coroado' };
        (cache.getDefaultRestaurant as any).mockResolvedValue(restaurant);

        const useCase = new GetDefaultRestaurantUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toBe(restaurant);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a default-restaurant scrape and returns a pending job when the cache misses', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getDefaultRestaurant as any).mockRejectedValue(new RuDigitalResourceNotFoundException('default-restaurant'));

        const useCase = new GetDefaultRestaurantUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ status: 'pending', resource: 'default-restaurant' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'default-restaurant',
            { credentials: CREDENTIALS },
            { dedupeKey: 'ru-digital-06124555212-ru-digital-default-restaurant' }
        );
    });

    it('propagates unexpected errors without enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getDefaultRestaurant as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetDefaultRestaurantUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

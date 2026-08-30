import { describe, expect, it, vi } from 'vitest';
import { ListRestaurantsUseCase } from '@ru-digital/application/use-cases/list-restaurants.usecase';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '06124555212' };

function buildDeps() {
    const cache = { listRestaurants: vi.fn() } as unknown as RuDigitalDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('ListRestaurantsUseCase', () => {
    it('returns the cached restaurant list when present', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const restaurants = [{ id: 'MAO', name: 'Manaus - Campus Coroado', city: 'Manaus - Campus Coroado' }];
        (cache.listRestaurants as any).mockResolvedValue(restaurants);

        const useCase = new ListRestaurantsUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toBe(restaurants);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a restaurant-list scrape and returns a pending job when the cache misses', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.listRestaurants as any).mockRejectedValue(new RuDigitalResourceNotFoundException('restaurant-list'));

        const useCase = new ListRestaurantsUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ status: 'pending', resource: 'restaurant-list' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'restaurant-list',
            { credentials: CREDENTIALS },
            { dedupeKey: 'ru-digital-06124555212-ru-digital-restaurant-list' }
        );
    });

    it('propagates unexpected errors without enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.listRestaurants as any).mockRejectedValue(new Error('redis down'));

        const useCase = new ListRestaurantsUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

import { describe, expect, it, vi } from 'vitest';
import { GetLastConsumptionUseCase } from '@ru-digital/application/use-cases/get-last-consumption.usecase';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '06124555212' };
const RESTAURANT_ID = 'MAO';

function buildDeps() {
    const cache = { getLastConsumption: vi.fn() } as unknown as RuDigitalDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetLastConsumptionUseCase', () => {
    it('returns the cached last consumption for the given restaurant', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const consumption = { hasPendingFeedback: false, consumptionId: 'abc', meal: null };
        (cache.getLastConsumption as any).mockResolvedValue(consumption);

        const useCase = new GetLastConsumptionUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS, RESTAURANT_ID);

        expect(result).toBe(consumption);
        expect(cache.getLastConsumption).toHaveBeenCalledWith(CREDENTIALS.cpf, RESTAURANT_ID);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a last-consumption scrape for the given restaurant and returns a pending job on a cache miss', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getLastConsumption as any).mockRejectedValue(new RuDigitalResourceNotFoundException('last-consumption'));

        const useCase = new GetLastConsumptionUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS, RESTAURANT_ID);

        expect(result).toEqual({ status: 'pending', resource: 'last-consumption' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'last-consumption',
            { credentials: CREDENTIALS, restaurantId: RESTAURANT_ID },
            { dedupeKey: `ru-digital-06124555212-ru-digital-last-consumption-${RESTAURANT_ID}` }
        );
    });

    it('propagates unexpected errors without enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getLastConsumption as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetLastConsumptionUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS, RESTAURANT_ID)).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

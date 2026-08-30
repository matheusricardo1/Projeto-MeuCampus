import { describe, expect, it, vi } from 'vitest';
import { GetLastConsumptionUseCase } from '@/application/use-cases/get-last-consumption.usecase';
import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

const CREDENTIALS = { cpf: '06124555212', token: 'jwt' };
const RESTAURANT_ID = 'MAO';

describe('GetLastConsumptionUseCase', () => {
    it('asserts the session is active, then runs the fetch through cache-and-publish for the "ultimo-consumo" resource', async () => {
        const consumption = { hasPendingFeedback: false, consumptionId: 'abc', meal: null };
        const repository = { getLastConsumption: vi.fn().mockResolvedValue(consumption) } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
        const cacheAndPublish = { run: vi.fn().mockImplementation((_resource, _cpf, promise) => promise) } as unknown as CacheAndPublishScrapedResource;

        const useCase = new GetLastConsumptionUseCase(repository, sessions, cacheAndPublish);
        const result = await useCase.execute(CREDENTIALS, RESTAURANT_ID);

        expect(sessions.assertActive).toHaveBeenCalledWith(CREDENTIALS.cpf);
        expect(cacheAndPublish.run).toHaveBeenCalledWith('ultimo-consumo', CREDENTIALS.cpf, expect.any(Promise));
        expect(repository.getLastConsumption).toHaveBeenCalledWith(CREDENTIALS, RESTAURANT_ID);
        expect(result).toBe(consumption);
    });

    it('propagates a session-invalidated error without calling the repository', async () => {
        const repository = { getLastConsumption: vi.fn() } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn().mockRejectedValue(new Error('expired')), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
        const cacheAndPublish = { run: vi.fn() } as unknown as CacheAndPublishScrapedResource;

        const useCase = new GetLastConsumptionUseCase(repository, sessions, cacheAndPublish);

        await expect(useCase.execute(CREDENTIALS, RESTAURANT_ID)).rejects.toThrow('expired');
        expect(repository.getLastConsumption).not.toHaveBeenCalled();
    });
});

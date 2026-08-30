import { describe, expect, it, vi } from 'vitest';
import { ListRestaurantsUseCase } from '@/application/use-cases/list-restaurants.usecase';
import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

const CREDENTIALS = { cpf: '06124555212', token: 'jwt' };

describe('ListRestaurantsUseCase', () => {
    it('asserts the session is active, then runs the fetch through cache-and-publish for the "restaurantes" resource', async () => {
        const restaurants = [{ id: 'MAO', name: 'Manaus - Campus Coroado', city: 'Manaus - Campus Coroado' }];
        const repository = { listRestaurants: vi.fn().mockResolvedValue(restaurants) } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
        const cacheAndPublish = { run: vi.fn().mockImplementation((_resource, _cpf, promise) => promise) } as unknown as CacheAndPublishScrapedResource;

        const useCase = new ListRestaurantsUseCase(repository, sessions, cacheAndPublish);
        const result = await useCase.execute(CREDENTIALS);

        expect(sessions.assertActive).toHaveBeenCalledWith(CREDENTIALS.cpf);
        expect(cacheAndPublish.run).toHaveBeenCalledWith('restaurantes', CREDENTIALS.cpf, expect.any(Promise));
        expect(repository.listRestaurants).toHaveBeenCalledWith(CREDENTIALS);
        expect(result).toBe(restaurants);
    });

    it('propagates a session-invalidated error without calling the repository', async () => {
        const repository = { listRestaurants: vi.fn() } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn().mockRejectedValue(new Error('expired')), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
        const cacheAndPublish = { run: vi.fn() } as unknown as CacheAndPublishScrapedResource;

        const useCase = new ListRestaurantsUseCase(repository, sessions, cacheAndPublish);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('expired');
        expect(repository.listRestaurants).not.toHaveBeenCalled();
    });
});

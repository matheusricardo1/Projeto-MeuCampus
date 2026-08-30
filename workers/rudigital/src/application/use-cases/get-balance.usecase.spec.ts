import { describe, expect, it, vi } from 'vitest';
import { GetBalanceUseCase } from '@/application/use-cases/get-balance.usecase';
import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

const CREDENTIALS = { cpf: '06124555212', token: 'jwt' };

describe('GetBalanceUseCase', () => {
    it('asserts the session is active, then runs the fetch through cache-and-publish for the "saldo" resource', async () => {
        const balance = { breakfast: {}, lunch: {}, dinner: {} };
        const repository = { getBalance: vi.fn().mockResolvedValue(balance) } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
        const cacheAndPublish = { run: vi.fn().mockImplementation((_resource, _cpf, promise) => promise) } as unknown as CacheAndPublishScrapedResource;

        const useCase = new GetBalanceUseCase(repository, sessions, cacheAndPublish);
        const result = await useCase.execute(CREDENTIALS);

        expect(sessions.assertActive).toHaveBeenCalledWith(CREDENTIALS.cpf);
        expect(cacheAndPublish.run).toHaveBeenCalledWith('saldo', CREDENTIALS.cpf, expect.any(Promise));
        expect(repository.getBalance).toHaveBeenCalledWith(CREDENTIALS);
        expect(result).toBe(balance);
    });

    it('propagates a session-invalidated error without calling the repository', async () => {
        const repository = { getBalance: vi.fn() } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn().mockRejectedValue(new Error('expired')), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
        const cacheAndPublish = { run: vi.fn() } as unknown as CacheAndPublishScrapedResource;

        const useCase = new GetBalanceUseCase(repository, sessions, cacheAndPublish);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('expired');
        expect(repository.getBalance).not.toHaveBeenCalled();
    });
});

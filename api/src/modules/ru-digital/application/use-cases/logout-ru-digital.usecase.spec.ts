import { describe, expect, it, vi } from 'vitest';
import { LogoutRuDigitalUseCase } from '@ru-digital/application/use-cases/logout-ru-digital.usecase';
import type { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import type { RuDigitalSessionRegistry } from '@ru-digital/application/ports/ru-digital-session-registry';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '06124555212', session: { token: 'jwt' } };

describe('LogoutRuDigitalUseCase', () => {
    it('enqueues a logout job, clears the cache, and invalidates the session', async () => {
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
        const cache = { clearUserCache: vi.fn().mockResolvedValue(3) } as unknown as RuDigitalDataRepository;
        const sessions = { invalidate: vi.fn(), activate: vi.fn(), isActive: vi.fn() } as unknown as RuDigitalSessionRegistry;

        const useCase = new LogoutRuDigitalUseCase(scrapingJobService, cache, sessions);
        await useCase.execute(CREDENTIALS);

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('logout', { credentials: CREDENTIALS });
        expect(cache.clearUserCache).toHaveBeenCalledWith(CREDENTIALS.cpf);
        expect(sessions.invalidate).toHaveBeenCalledWith(CREDENTIALS.cpf);
    });
});

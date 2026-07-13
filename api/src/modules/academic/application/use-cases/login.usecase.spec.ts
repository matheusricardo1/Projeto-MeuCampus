import { describe, expect, it, vi } from 'vitest';
import { LoginUseCase } from '@academic/application/use-cases/login.usecase';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

describe('LoginUseCase', () => {
    it('enqueues a login job with the given credentials and returns its id as a string', async () => {
        const scrapingJobService = {
            enqueue: vi.fn().mockResolvedValue({ id: 12345 })
        } as unknown as ScrapingJobService;

        const useCase = new LoginUseCase(scrapingJobService);
        const result = await useCase.execute({ cpf: '12345678900', password: 'secret' });

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('login', { cpf: '12345678900', password: 'secret' });
        expect(result).toEqual({ jobId: '12345' });
    });

    it('stringifies a non-numeric job id as-is', async () => {
        const scrapingJobService = {
            enqueue: vi.fn().mockResolvedValue({ id: 'uuid-job-id' })
        } as unknown as ScrapingJobService;

        const useCase = new LoginUseCase(scrapingJobService);
        const result = await useCase.execute({ cpf: '12345678900', password: 'secret' });

        expect(result).toEqual({ jobId: 'uuid-job-id' });
    });
});

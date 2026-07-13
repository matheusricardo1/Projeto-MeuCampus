import { describe, expect, it, vi } from 'vitest';
import { GetProfileUseCase } from '@academic/application/use-cases/get-profile.usecase';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { StudentProfile } from '@academic/domain/entities/student-profile.entity';

const CREDENTIALS = { cpf: '12345678900' };

function buildDeps() {
    const cache = { getProfile: vi.fn() } as unknown as AcademicDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetProfileUseCase', () => {
    it('returns the cached profile when present', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const profile = { personal: {}, academic: {}, contact: {} } as unknown as StudentProfile;
        (cache.getProfile as any).mockResolvedValue(profile);

        const useCase = new GetProfileUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toBe(profile);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a profile scrape and returns a pending job when the cache misses', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getProfile as any).mockRejectedValue(new AcademicResourceNotFoundException('profile'));

        const useCase = new GetProfileUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ status: 'pending', resource: 'profile' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'profile',
            { credentials: CREDENTIALS },
            { dedupeKey: '12345678900-profile' }
        );
    });

    it('propagates unexpected errors without enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getProfile as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetProfileUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

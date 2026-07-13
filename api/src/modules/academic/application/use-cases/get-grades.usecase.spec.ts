import { describe, expect, it, vi } from 'vitest';
import { GetGradesUseCase } from '@academic/application/use-cases/get-grades.usecase';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '12345678900' };

function buildDeps() {
    const cache = {
        getGrades: vi.fn(),
        getCurrentPeriodHint: vi.fn()
    } as unknown as AcademicDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetGradesUseCase', () => {
    it('returns cached grades directly when year and period are explicitly given', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const grades = [{ code: 'MAT101' }];
        (cache.getGrades as any).mockResolvedValue(grades);

        const useCase = new GetGradesUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, year: '2024', period: '1' });

        expect(result).toBe(grades);
        expect(cache.getCurrentPeriodHint).not.toHaveBeenCalled();
        expect(cache.getGrades).toHaveBeenCalledWith('12345678900', '2024', '1');
    });

    it('resolves the current period from the cache hint when year/period are omitted', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getCurrentPeriodHint as any).mockResolvedValue({ year: '2024', period: '2' });
        (cache.getGrades as any).mockResolvedValue([{ code: 'FIS201' }]);

        const useCase = new GetGradesUseCase(cache, scrapingJobService);
        await useCase.execute({ credentials: CREDENTIALS });

        expect(cache.getGrades).toHaveBeenCalledWith('12345678900', '2024', '2');
    });

    it('enqueues a grades scrape with no year/period when there is no cached period hint yet', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getCurrentPeriodHint as any).mockResolvedValue(null);

        const useCase = new GetGradesUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS });

        expect(result).toEqual({ status: 'pending', resource: 'grades' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'grades',
            { credentials: CREDENTIALS },
            { dedupeKey: '12345678900-grades' }
        );
    });

    it('enqueues a grades scrape scoped to year/period when the hinted period is not cached yet', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getCurrentPeriodHint as any).mockResolvedValue({ year: '2024', period: '1' });
        (cache.getGrades as any).mockRejectedValue(new AcademicResourceNotFoundException('grades'));

        const useCase = new GetGradesUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS });

        expect(result).toEqual({ status: 'pending', resource: 'grades' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'grades',
            { credentials: CREDENTIALS, year: '2024', period: '1' },
            { dedupeKey: '12345678900-grades-2024-1' }
        );
    });

    it('enqueues a scrape when the explicitly requested year/period is not cached', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getGrades as any).mockRejectedValue(new AcademicResourceNotFoundException('grades'));

        const useCase = new GetGradesUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, year: '2023', period: '2' });

        expect(result).toEqual({ status: 'pending', resource: 'grades' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'grades',
            { credentials: CREDENTIALS, year: '2023', period: '2' },
            { dedupeKey: '12345678900-grades-2023-2' }
        );
    });

    it('propagates unexpected cache errors instead of enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getGrades as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetGradesUseCase(cache, scrapingJobService);

        await expect(useCase.execute({ credentials: CREDENTIALS, year: '2024', period: '1' })).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

import { describe, expect, it, vi } from 'vitest';
import { FindGradesAcrossPreviousPeriodsUseCase } from '@academic/application/use-cases/find-grades-across-previous-periods.usecase';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '12345678900' };

function buildDeps() {
    const cache = {
        getProfile: vi.fn().mockResolvedValue({ academic: { admission_term: '2022.1' } }),
        getCurrentPeriodHint: vi.fn().mockResolvedValue({ year: '2026', period: '1' }),
        getGrades: vi.fn()
    } as unknown as AcademicDataRepository;
    const scrapingJobService = {
        enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn().mockResolvedValue(undefined) })
    } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('FindGradesAcrossPreviousPeriodsUseCase', () => {
    it('finds a match in the most recent previous period already cached, without scraping', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getGrades as any).mockResolvedValue([{ code: 'MAT101', subject: 'Calculo 2' }]);

        const useCase = new FindGradesAcrossPreviousPeriodsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, subjectQuery: 'calculo 2' });

        expect(result).toEqual({
            found: true,
            year: '2025',
            period: '2',
            matches: [{ code: 'MAT101', subject: 'Calculo 2' }],
            periodsChecked: [{ year: '2025', period: '2' }]
        });
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('keeps walking backwards past periods with no matching subject', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getGrades as any)
            .mockResolvedValueOnce([{ code: 'FIS201', subject: 'Fisica 1' }])
            .mockResolvedValueOnce([{ code: 'MAT101', subject: 'Calculo 2' }]);

        const useCase = new FindGradesAcrossPreviousPeriodsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, subjectQuery: 'calculo 2' });

        expect(result).toMatchObject({ found: true, year: '2025', period: '1' });
        expect(cache.getGrades).toHaveBeenCalledTimes(2);
    });

    it('live-scrapes a period on a cache miss and returns the match once the job finishes', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getGrades as any)
            .mockRejectedValueOnce(new AcademicResourceNotFoundException('grades'))
            .mockResolvedValueOnce([{ code: 'MAT101', subject: 'Calculo 2' }]);

        const useCase = new FindGradesAcrossPreviousPeriodsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, subjectQuery: 'calculo 2' });

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'grades',
            { credentials: CREDENTIALS, year: '2025', period: '2' },
            { dedupeKey: '12345678900-grades-2025-2' }
        );
        expect(result).toMatchObject({ found: true, year: '2025', period: '2' });
    });

    it('stops the search at the student admission year and reports what it checked', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getCurrentPeriodHint as any).mockResolvedValue({ year: '2023', period: '1' });
        (cache.getGrades as any).mockResolvedValue([{ code: 'FIS201', subject: 'Fisica 1' }]);

        const useCase = new FindGradesAcrossPreviousPeriodsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, subjectQuery: 'calculo 2' });

        expect(result).toEqual({
            found: false,
            periodsChecked: [{ year: '2022', period: '2' }, { year: '2022', period: '1' }],
            searchedBackToYear: '2022'
        });
    });

    it('resumes from beforeYear/beforePeriod instead of the current period', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getGrades as any).mockResolvedValue([{ code: 'MAT101', subject: 'Calculo 2' }]);

        const useCase = new FindGradesAcrossPreviousPeriodsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({
            credentials: CREDENTIALS,
            subjectQuery: 'calculo 2',
            beforeYear: '2025',
            beforePeriod: '2'
        });

        expect(result).toMatchObject({ year: '2025', period: '1' });
    });

    it('stops triggering new live scrapes once the budget is exhausted, but keeps checking cache', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getCurrentPeriodHint as any).mockResolvedValue({ year: '2026', period: '1' });
        (cache.getGrades as any).mockRejectedValue(new AcademicResourceNotFoundException('grades'));

        const useCase = new FindGradesAcrossPreviousPeriodsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, subjectQuery: 'calculo 2' });

        expect(result.found).toBe(false);
        // 2022.1 admission -> candidates 2025/2 .. 2022/1 is 8 periods; only the first 4 (the live-scrape budget) should trigger enqueue.
        expect(scrapingJobService.enqueue).toHaveBeenCalledTimes(4);
    });
});

import { describe, expect, it, vi } from 'vitest';
import { GetAcademicSubjectsUseCase } from '@academic/application/use-cases/get-academic-subjects.usecase';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '12345678900' };

function buildDeps() {
    const cache = {
        getAcademicSubjects: vi.fn(),
        getCurrentPeriodHint: vi.fn(),
        getGrades: vi.fn()
    } as unknown as AcademicDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetAcademicSubjectsUseCase', () => {
    it('returns cached subjects directly when year and period are explicitly given', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const subjects = [{ code: 'MAT101' }];
        (cache.getAcademicSubjects as any).mockResolvedValue(subjects);

        const useCase = new GetAcademicSubjectsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, year: '2024', period: '1' });

        expect(result).toBe(subjects);
        expect(cache.getAcademicSubjects).toHaveBeenCalledWith('12345678900', '2024', '1');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a grades scrape with no year/period when there is no cached period hint yet', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getCurrentPeriodHint as any).mockResolvedValue(null);

        const useCase = new GetAcademicSubjectsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS });

        expect(result).toEqual({ status: 'pending', resource: 'grades' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'grades',
            { credentials: CREDENTIALS },
            { dedupeKey: '12345678900-grades' }
        );
    });

    it('enqueues a grades scrape scoped to year/period when the hinted period has no grades cached yet', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getCurrentPeriodHint as any).mockResolvedValue({ year: '2024', period: '1' });
        (cache.getGrades as any).mockRejectedValue(new AcademicResourceNotFoundException('grades'));

        const useCase = new GetAcademicSubjectsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS });

        expect(result).toEqual({ status: 'pending', resource: 'grades' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'grades',
            { credentials: CREDENTIALS, year: '2024', period: '1' },
            { dedupeKey: '12345678900-grades-2024-1' }
        );
    });

    it('enqueues a grades scrape when the resolved subjects lookup itself is missing grades', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getAcademicSubjects as any).mockRejectedValue(new AcademicResourceNotFoundException('grades'));

        const useCase = new GetAcademicSubjectsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, year: '2024', period: '1' });

        expect(result).toEqual({ status: 'pending', resource: 'grades' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'grades',
            { credentials: CREDENTIALS, year: '2024', period: '1' },
            { dedupeKey: '12345678900-grades-2024-1' }
        );
    });

    it('enqueues a schedule scrape (no year/period) when schedule data is the missing piece', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getAcademicSubjects as any).mockRejectedValue(new AcademicResourceNotFoundException('schedule'));

        const useCase = new GetAcademicSubjectsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, year: '2024', period: '1' });

        expect(result).toEqual({ status: 'pending', resource: 'schedule' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'schedule',
            { credentials: CREDENTIALS },
            { dedupeKey: '12345678900-schedule' }
        );
    });

    it('enqueues a lesson-plan-subjects scrape when that is the missing piece', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getAcademicSubjects as any).mockRejectedValue(new AcademicResourceNotFoundException('lesson-plan-subjects'));

        const useCase = new GetAcademicSubjectsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, year: '2024', period: '1' });

        expect(result).toEqual({ status: 'pending', resource: 'lesson-plan-subjects' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'lesson-plan-subjects',
            { credentials: CREDENTIALS },
            { dedupeKey: '12345678900-lesson-plan-subjects' }
        );
    });

    it('returns a pending job without enqueueing anything for resources it does not know how to scrape on its own (e.g. profile)', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getAcademicSubjects as any).mockRejectedValue(new AcademicResourceNotFoundException('profile'));

        const useCase = new GetAcademicSubjectsUseCase(cache, scrapingJobService);
        const result = await useCase.execute({ credentials: CREDENTIALS, year: '2024', period: '1' });

        expect(result).toEqual({ status: 'pending', resource: 'profile' });
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('propagates unexpected errors', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getAcademicSubjects as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetAcademicSubjectsUseCase(cache, scrapingJobService);

        await expect(useCase.execute({ credentials: CREDENTIALS, year: '2024', period: '1' })).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

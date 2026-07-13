import { describe, expect, it, vi } from 'vitest';
import { GetLessonPlanSubjectsUseCase } from '@academic/application/use-cases/get-lesson-plan-subjects.usecase';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '12345678900' };

function buildDeps() {
    const cache = { getLessonPlanSubjects: vi.fn() } as unknown as AcademicDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetLessonPlanSubjectsUseCase', () => {
    it('returns the cached subjects when present', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const subjects = [{ planId: '1', code: 'MAT101', subject: 'Calculo I', classIdentifier: 'T01', credits: 4, professor: '', workloadHours: 60, available: true }];
        (cache.getLessonPlanSubjects as any).mockResolvedValue(subjects);

        const useCase = new GetLessonPlanSubjectsUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toBe(subjects);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a lesson-plan-subjects scrape and returns a pending job when the cache misses', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getLessonPlanSubjects as any).mockRejectedValue(new AcademicResourceNotFoundException('lesson-plan-subjects'));

        const useCase = new GetLessonPlanSubjectsUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ status: 'pending', resource: 'lesson-plan-subjects' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'lesson-plan-subjects',
            { credentials: CREDENTIALS },
            { dedupeKey: '12345678900-lesson-plan-subjects' }
        );
    });

    it('propagates unexpected errors without enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getLessonPlanSubjects as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetLessonPlanSubjectsUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

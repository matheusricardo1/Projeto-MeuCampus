import { describe, expect, it, vi } from 'vitest';
import { GetLessonPlanUseCase } from '@academic/application/use-cases/get-lesson-plan.usecase';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '12345678900' };

function buildDeps() {
    const cache = { getLessonPlan: vi.fn() } as unknown as AcademicDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetLessonPlanUseCase', () => {
    it('returns the cached lesson plan for the given planId', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const plan = [{ date: '01/03', workload: 2, type: 'Teorica', content: 'Intro', professor: 'Dr. Fulano' }];
        (cache.getLessonPlan as any).mockResolvedValue(plan);

        const useCase = new GetLessonPlanUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS, 'PLAN-1');

        expect(result).toBe(plan);
        expect(cache.getLessonPlan).toHaveBeenCalledWith('12345678900', 'PLAN-1');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a lesson-plan scrape scoped to the planId and returns a pending job on a cache miss', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getLessonPlan as any).mockRejectedValue(new AcademicResourceNotFoundException('lesson-plan'));

        const useCase = new GetLessonPlanUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS, 'PLAN-1');

        expect(result).toEqual({ status: 'pending', resource: 'lesson-plan' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'lesson-plan',
            { credentials: CREDENTIALS, planId: 'PLAN-1' },
            { dedupeKey: '12345678900-lesson-plan-PLAN-1' }
        );
    });

    it('propagates unexpected errors without enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getLessonPlan as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetLessonPlanUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS, 'PLAN-1')).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

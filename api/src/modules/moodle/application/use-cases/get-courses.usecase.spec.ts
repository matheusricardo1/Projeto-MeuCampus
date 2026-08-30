import { describe, expect, it, vi } from 'vitest';
import { GetCoursesUseCase } from '@moodle/application/use-cases/get-courses.usecase';
import { MoodleResourceNotFoundException } from '@moodle/domain/exceptions/moodle-resource-not-found.exception';
import type { MoodleDataRepository } from '@moodle/domain/repositories/moodle-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1' };

function buildDeps() {
    const cache = { getCourses: vi.fn(), getTimeline: vi.fn(), clearUserCache: vi.fn() } as unknown as MoodleDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetCoursesUseCase', () => {
    it('returns the cached courses when present', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const courses = [{ id: 350, shortName: 'IBD-ES', fullName: 'Introducao a Banco de Dados', displayName: 'IBD', imageUrl: null, progress: null, startDate: 1785988800, endDate: null, visible: true }];
        (cache.getCourses as any).mockResolvedValue(courses);

        const useCase = new GetCoursesUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(cache.getCourses).toHaveBeenCalledWith('icomp-colab:matheusricardo1');
        expect(result).toBe(courses);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a courses sync and returns a pending job when the cache misses', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getCourses as any).mockRejectedValue(new MoodleResourceNotFoundException('courses'));

        const useCase = new GetCoursesUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ status: 'pending', resource: 'courses' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'courses',
            { credentials: CREDENTIALS },
            { dedupeKey: 'moodle-icomp-colab:matheusricardo1-moodle-courses' }
        );
    });

    it('propagates unexpected errors without enqueueing a sync', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getCourses as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetCoursesUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});

import { describe, expect, it, vi } from 'vitest';
import { GetTimelineUseCase } from '@moodle/application/use-cases/get-timeline.usecase';
import { MoodleResourceNotFoundException } from '@moodle/domain/exceptions/moodle-resource-not-found.exception';
import type { MoodleDataRepository } from '@moodle/domain/repositories/moodle-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { instanceId: 'colabweb' as const, username: 'matheusricardo1' };

function buildDeps() {
    const cache = { getCourses: vi.fn(), getTimeline: vi.fn(), clearUserCache: vi.fn() } as unknown as MoodleDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetTimelineUseCase', () => {
    it('returns the cached timeline when present', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const timeline = [{ id: 1, name: 'Resumo de literatura', description: null, courseId: 350, courseName: 'IBD', activityType: 'assign', url: null, dueAt: 1788285600 }];
        (cache.getTimeline as any).mockResolvedValue(timeline);

        const useCase = new GetTimelineUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(cache.getTimeline).toHaveBeenCalledWith('colabweb:matheusricardo1');
        expect(result).toBe(timeline);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a timeline sync and returns a pending job when the cache misses', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getTimeline as any).mockRejectedValue(new MoodleResourceNotFoundException('timeline'));

        const useCase = new GetTimelineUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ status: 'pending', resource: 'timeline' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'timeline',
            { credentials: CREDENTIALS },
            { dedupeKey: 'moodle-colabweb:matheusricardo1-moodle-timeline' }
        );
    });
});

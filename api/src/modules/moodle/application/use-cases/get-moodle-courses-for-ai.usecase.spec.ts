import { describe, expect, it, vi } from 'vitest';
import { GetMoodleCoursesForAiUseCase } from '@moodle/application/use-cases/get-moodle-courses-for-ai.usecase';
import { NOT_LINKED, type ResolveMoodleSessionForAiUseCase } from '@moodle/application/use-cases/resolve-moodle-session-for-ai.usecase';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

describe('GetMoodleCoursesForAiUseCase', () => {
    it('returns NOT_LINKED without enqueueing a fetch when the session cannot be resolved', async () => {
        const resolveSession = { execute: vi.fn().mockResolvedValue(NOT_LINKED) } as unknown as ResolveMoodleSessionForAiUseCase;
        const scrapingJobService = { enqueue: vi.fn() } as unknown as ScrapingJobService;

        const useCase = new GetMoodleCoursesForAiUseCase(resolveSession, scrapingJobService);
        const result = await useCase.execute('12345678900');

        expect(result).toBe(NOT_LINKED);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('fetches courses with the resolved credentials and waits for the job', async () => {
        const credentials = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1', session: { token: 'x' } };
        const resolveSession = { execute: vi.fn().mockResolvedValue(credentials) } as unknown as ResolveMoodleSessionForAiUseCase;
        const courses = [{ id: 350, shortName: 'IBD-ES' }];
        const waitUntilFinished = vi.fn().mockResolvedValue(courses);
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished }) } as unknown as ScrapingJobService;

        const useCase = new GetMoodleCoursesForAiUseCase(resolveSession, scrapingJobService);
        const result = await useCase.execute('12345678900', 'icomp-colab');

        expect(resolveSession.execute).toHaveBeenCalledWith('12345678900', 'icomp-colab');
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('courses', { credentials });
        expect(result).toBe(courses);
    });
});

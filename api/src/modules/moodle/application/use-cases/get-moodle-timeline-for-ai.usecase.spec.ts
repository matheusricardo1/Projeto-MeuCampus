import { describe, expect, it, vi } from 'vitest';
import { GetMoodleTimelineForAiUseCase } from '@moodle/application/use-cases/get-moodle-timeline-for-ai.usecase';
import { NOT_LINKED, type ResolveMoodleSessionForAiUseCase } from '@moodle/application/use-cases/resolve-moodle-session-for-ai.usecase';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

describe('GetMoodleTimelineForAiUseCase', () => {
    it('returns NOT_LINKED without enqueueing a fetch when the session cannot be resolved', async () => {
        const resolveSession = { execute: vi.fn().mockResolvedValue(NOT_LINKED) } as unknown as ResolveMoodleSessionForAiUseCase;
        const scrapingJobService = { enqueue: vi.fn() } as unknown as ScrapingJobService;

        const useCase = new GetMoodleTimelineForAiUseCase(resolveSession, scrapingJobService);
        const result = await useCase.execute('12345678900');

        expect(result).toBe(NOT_LINKED);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('fetches the timeline with the resolved credentials and waits for the job', async () => {
        const credentials = { instanceId: 'colabweb' as const, username: 'matheusricardo1', session: { token: 'x' } };
        const resolveSession = { execute: vi.fn().mockResolvedValue(credentials) } as unknown as ResolveMoodleSessionForAiUseCase;
        const timeline = [{ id: 1, name: 'Resumo de literatura' }];
        const waitUntilFinished = vi.fn().mockResolvedValue(timeline);
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished }) } as unknown as ScrapingJobService;

        const useCase = new GetMoodleTimelineForAiUseCase(resolveSession, scrapingJobService);
        const result = await useCase.execute('12345678900');

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('timeline', { credentials });
        expect(result).toBe(timeline);
    });
});

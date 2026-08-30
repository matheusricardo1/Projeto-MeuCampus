import { describe, expect, it, vi } from 'vitest';
import { LogoutMoodleUseCase } from '@moodle/application/use-cases/logout-moodle.usecase';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { MoodleDataRepository } from '@moodle/domain/repositories/moodle-data.repository';
import type { MoodleSessionRegistry } from '@moodle/application/ports/moodle-session-registry';

const CREDENTIALS = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1', session: { token: 'wstoken-abc' } };

describe('LogoutMoodleUseCase', () => {
    it('enqueues a logout job, clears the cache, and invalidates the session by identity', async () => {
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
        const cache = { getCourses: vi.fn(), getTimeline: vi.fn(), clearUserCache: vi.fn().mockResolvedValue(2) } as unknown as MoodleDataRepository;
        const sessions = { activate: vi.fn(), invalidate: vi.fn(), isActive: vi.fn() } as unknown as MoodleSessionRegistry;

        const useCase = new LogoutMoodleUseCase(scrapingJobService, cache, sessions);
        await useCase.execute(CREDENTIALS);

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('logout', { credentials: CREDENTIALS });
        expect(cache.clearUserCache).toHaveBeenCalledWith('icomp-colab:matheusricardo1');
        expect(sessions.invalidate).toHaveBeenCalledWith('icomp-colab:matheusricardo1');
    });
});

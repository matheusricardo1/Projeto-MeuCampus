import { describe, expect, it, vi } from 'vitest';
import { GetTimelineUseCase } from '@/application/use-cases/get-timeline.usecase';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';
import type { MoodleRepository } from '@/domain/repositories/moodle.repository';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';
import type { MoodleCacheStore } from '@/application/ports/moodle-cache-store';
import type { MoodleScrapeEventPublisher } from '@/application/ports/moodle-scrape-event-publisher';

const CREDENTIALS = { instanceId: 'colabweb' as const, username: 'matheusricardo1', session: { token: 'wstoken-abc', userId: 19417 } };

describe('GetTimelineUseCase', () => {
    it('asserts the session is active, fetches the timeline, caches it, and returns it', async () => {
        const events = [{ id: 1, name: 'Resumo de literatura', description: null, courseId: 350, courseName: 'IBD', activityType: 'assign', url: null, dueAt: 1788285600 }];
        const repository = { logout: vi.fn(), getCourses: vi.fn(), getTimeline: vi.fn().mockResolvedValue(events) } as unknown as MoodleRepository;
        const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as MoodleSessionStore;
        const cache = { save: vi.fn(), get: vi.fn(), clearUserCache: vi.fn() } as unknown as MoodleCacheStore;
        const eventPublisher = { publishReady: vi.fn(), publishFailed: vi.fn(), publishLoginReady: vi.fn(), publishLoginFailed: vi.fn() } as unknown as MoodleScrapeEventPublisher;
        const cacheAndPublish = new CacheAndPublishScrapedResource(sessions, cache, eventPublisher);

        const useCase = new GetTimelineUseCase(repository, sessions, cacheAndPublish);
        const result = await useCase.execute(CREDENTIALS);

        expect(sessions.assertActive).toHaveBeenCalledWith('colabweb:matheusricardo1');
        expect(repository.getTimeline).toHaveBeenCalledWith(CREDENTIALS);
        expect(cache.save).toHaveBeenCalledWith('timeline', 'colabweb:matheusricardo1', events, undefined);
        expect(result).toBe(events);
    });
});

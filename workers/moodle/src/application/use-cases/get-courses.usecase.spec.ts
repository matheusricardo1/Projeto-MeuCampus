import { describe, expect, it, vi } from 'vitest';
import { GetCoursesUseCase } from '@/application/use-cases/get-courses.usecase';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';
import type { MoodleRepository } from '@/domain/repositories/moodle.repository';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';
import type { MoodleCacheStore } from '@/application/ports/moodle-cache-store';
import type { MoodleScrapeEventPublisher } from '@/application/ports/moodle-scrape-event-publisher';

const CREDENTIALS = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1', session: { token: 'wstoken-abc', userId: 140 } };

describe('GetCoursesUseCase', () => {
    it('asserts the session is active, fetches courses, caches them, and returns them', async () => {
        const courses = [{ id: 350, shortName: 'IBD-ES', fullName: 'Introducao a Banco de Dados', displayName: 'IBD', imageUrl: null, progress: null, startDate: 1785988800, endDate: null, visible: true }];
        const repository = { logout: vi.fn(), getCourses: vi.fn().mockResolvedValue(courses), getTimeline: vi.fn() } as unknown as MoodleRepository;
        const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as MoodleSessionStore;
        const cache = { save: vi.fn(), get: vi.fn(), clearUserCache: vi.fn() } as unknown as MoodleCacheStore;
        const events = { publishReady: vi.fn(), publishFailed: vi.fn(), publishLoginReady: vi.fn(), publishLoginFailed: vi.fn() } as unknown as MoodleScrapeEventPublisher;
        const cacheAndPublish = new CacheAndPublishScrapedResource(sessions, cache, events);

        const useCase = new GetCoursesUseCase(repository, sessions, cacheAndPublish);
        const result = await useCase.execute(CREDENTIALS);

        expect(sessions.assertActive).toHaveBeenCalledWith('icomp-colab:matheusricardo1');
        expect(repository.getCourses).toHaveBeenCalledWith(CREDENTIALS);
        expect(cache.save).toHaveBeenCalledWith('courses', 'icomp-colab:matheusricardo1', courses, undefined);
        expect(result).toBe(courses);
    });

    it('rejects up front when the session is not active, without calling the repository', async () => {
        const repository = { logout: vi.fn(), getCourses: vi.fn(), getTimeline: vi.fn() } as unknown as MoodleRepository;
        const sessions = { assertActive: vi.fn().mockRejectedValue(new Error('Sua sessao do Moodle expirou. Entre novamente.')), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as MoodleSessionStore;
        const cache = { save: vi.fn(), get: vi.fn(), clearUserCache: vi.fn() } as unknown as MoodleCacheStore;
        const events = { publishReady: vi.fn(), publishFailed: vi.fn(), publishLoginReady: vi.fn(), publishLoginFailed: vi.fn() } as unknown as MoodleScrapeEventPublisher;
        const cacheAndPublish = new CacheAndPublishScrapedResource(sessions, cache, events);

        const useCase = new GetCoursesUseCase(repository, sessions, cacheAndPublish);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('Sua sessao do Moodle expirou. Entre novamente.');
        expect(repository.getCourses).not.toHaveBeenCalled();
    });
});

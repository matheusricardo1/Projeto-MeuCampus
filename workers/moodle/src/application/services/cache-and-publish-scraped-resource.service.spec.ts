import { describe, expect, it, vi } from 'vitest';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';
import type { MoodleCacheStore } from '@/application/ports/moodle-cache-store';
import type { MoodleScrapeEventPublisher } from '@/application/ports/moodle-scrape-event-publisher';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';

function buildDeps() {
    const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as MoodleSessionStore;
    const cache = { save: vi.fn(), get: vi.fn(), clearUserCache: vi.fn() } as unknown as MoodleCacheStore;
    const events = { publishReady: vi.fn(), publishFailed: vi.fn(), publishLoginReady: vi.fn(), publishLoginFailed: vi.fn() } as unknown as MoodleScrapeEventPublisher;
    return { sessions, cache, events };
}

describe('CacheAndPublishScrapedResource', () => {
    it('awaits the result, re-checks the session, caches it, and publishes a ready event', async () => {
        const { sessions, cache, events } = buildDeps();
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);
        const result = [{ id: 1 }];

        const returned = await service.run('courses', 'icomp-colab:matheusricardo1', Promise.resolve(result));

        expect(returned).toBe(result);
        expect(sessions.assertActive).toHaveBeenCalledWith('icomp-colab:matheusricardo1');
        expect(cache.save).toHaveBeenCalledWith('courses', 'icomp-colab:matheusricardo1', result, undefined);
        expect(events.publishReady).toHaveBeenCalledWith({ identity: 'icomp-colab:matheusricardo1', resource: 'courses' });
    });

    it('forwards the extra key to both the cache write and the published event when given', async () => {
        const { sessions, cache, events } = buildDeps();
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        await service.run('timeline', 'colabweb:matheusricardo1', Promise.resolve([]), '2026-2');

        expect(cache.save).toHaveBeenCalledWith('timeline', 'colabweb:matheusricardo1', [], '2026-2');
        expect(events.publishReady).toHaveBeenCalledWith({ identity: 'colabweb:matheusricardo1', resource: 'timeline', extra: '2026-2' });
    });

    it('propagates a rejected result without touching the session, cache, or events', async () => {
        const { sessions, cache, events } = buildDeps();
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        await expect(service.run('courses', 'icomp-colab:matheusricardo1', Promise.reject(new Error('moodle down')))).rejects.toThrow('moodle down');

        expect(sessions.assertActive).not.toHaveBeenCalled();
        expect(cache.save).not.toHaveBeenCalled();
        expect(events.publishReady).not.toHaveBeenCalled();
    });

    it('propagates a session-invalidation error raised after the fetch already succeeded, without caching', async () => {
        const { sessions, cache, events } = buildDeps();
        (sessions.assertActive as any).mockRejectedValue(new Error('session expired mid-flight'));
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        await expect(service.run('courses', 'icomp-colab:matheusricardo1', Promise.resolve([]))).rejects.toThrow('session expired mid-flight');

        expect(cache.save).not.toHaveBeenCalled();
        expect(events.publishReady).not.toHaveBeenCalled();
    });
});

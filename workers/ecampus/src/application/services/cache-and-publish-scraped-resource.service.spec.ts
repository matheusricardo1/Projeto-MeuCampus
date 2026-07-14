import { describe, expect, it, vi } from 'vitest';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';
import type { EcampusCacheStore } from '@/application/ports/ecampus-cache-store';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusScrapeEventPublisher } from '@/application/ports/ecampus-scrape-event-publisher';

const CPF = '12345678900';

function buildDeps(cacheOverrides: Partial<EcampusCacheStore> = {}) {
    const cache = {
        save: vi.fn(),
        get: vi.fn().mockResolvedValue(null),
        saveCurrentPeriod: vi.fn(),
        clearUserCache: vi.fn(),
        ...cacheOverrides
    } as unknown as EcampusCacheStore;
    const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as EcampusSessionStore;
    const events = { publishReady: vi.fn(), publishFailed: vi.fn(), publishLoginReady: vi.fn(), publishLoginFailed: vi.fn() } as unknown as EcampusScrapeEventPublisher;
    return { cache, sessions, events };
}

describe('CacheAndPublishScrapedResource', () => {
    it('caches and returns a non-empty schedule result normally', async () => {
        const { cache, sessions, events } = buildDeps();
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        const result = await service.run('schedule', CPF, Promise.resolve([{ weekday: 'Monday' }]));

        expect(result).toEqual([{ weekday: 'Monday' }]);
        expect(cache.save).toHaveBeenCalledWith('schedule', CPF, [{ weekday: 'Monday' }], undefined);
        expect(events.publishReady).toHaveBeenCalledWith({ cpf: CPF, resource: 'schedule' });
    });

    it('keeps the previously cached non-empty schedule instead of overwriting it with an empty scrape', async () => {
        const { cache, sessions, events } = buildDeps({ get: vi.fn().mockResolvedValue([{ weekday: 'Monday' }]) });
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        const result = await service.run('schedule', CPF, Promise.resolve([]));

        expect(result).toEqual([{ weekday: 'Monday' }]);
        expect(cache.save).not.toHaveBeenCalled();
        expect(events.publishReady).toHaveBeenCalledWith({ cpf: CPF, resource: 'schedule' });
    });

    it('caches an empty schedule when there was nothing good cached before', async () => {
        const { cache, sessions, events } = buildDeps({ get: vi.fn().mockResolvedValue(null) });
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        const result = await service.run('schedule', CPF, Promise.resolve([]));

        expect(result).toEqual([]);
        expect(cache.save).toHaveBeenCalledWith('schedule', CPF, [], undefined);
    });

    it('applies the same empty-overwrite guard to lesson-plan-subjects', async () => {
        const { cache, sessions, events } = buildDeps({ get: vi.fn().mockResolvedValue([{ code: 'MAT101' }]) });
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        const result = await service.run('lesson-plan-subjects', CPF, Promise.resolve([]));

        expect(result).toEqual([{ code: 'MAT101' }]);
        expect(cache.save).not.toHaveBeenCalled();
    });

    it('does not apply the guard to grades - an empty period result is cached as-is', async () => {
        const { cache, sessions, events } = buildDeps();
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        const result = await service.run('grades', CPF, Promise.resolve([]), { year: '2026', period: '1' });

        expect(result).toEqual([]);
        expect(cache.save).toHaveBeenCalledWith('grades', CPF, [], '2026-1');
        expect(cache.get).not.toHaveBeenCalled();
        expect(cache.saveCurrentPeriod).toHaveBeenCalledWith(CPF, '2026', '1');
    });
});

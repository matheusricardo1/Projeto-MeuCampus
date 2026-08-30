import { describe, expect, it, vi } from 'vitest';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';
import type { RuDigitalCacheStore } from '@/application/ports/ru-digital-cache-store';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalScrapeEventPublisher } from '@/application/ports/ru-digital-scrape-event-publisher';

const CPF = '06124555212';

function buildDeps() {
    const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
    const cache = { save: vi.fn(), get: vi.fn(), clearUserCache: vi.fn() } as unknown as RuDigitalCacheStore;
    const events = { publishReady: vi.fn(), publishFailed: vi.fn(), publishLoginReady: vi.fn(), publishLoginFailed: vi.fn() } as unknown as RuDigitalScrapeEventPublisher;
    return { sessions, cache, events };
}

describe('CacheAndPublishScrapedResource', () => {
    it('caches the resolved result, publishes a ready event without a date, and returns the result', async () => {
        const { sessions, cache, events } = buildDeps();
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        const result = await service.run('saldo', CPF, Promise.resolve({ breakfast: {} }));

        expect(result).toEqual({ breakfast: {} });
        expect(sessions.assertActive).toHaveBeenCalledWith(CPF);
        expect(cache.save).toHaveBeenCalledWith('saldo', CPF, { breakfast: {} }, undefined);
        expect(events.publishReady).toHaveBeenCalledWith({ cpf: CPF, resource: 'saldo' });
    });

    it('threads the date through to both the cache key and the published event for a date-scoped resource', async () => {
        const { sessions, cache, events } = buildDeps();
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        await service.run('cardapio', CPF, Promise.resolve({ items: [] }), '2026-08-28');

        expect(cache.save).toHaveBeenCalledWith('cardapio', CPF, { items: [] }, '2026-08-28');
        expect(events.publishReady).toHaveBeenCalledWith({ cpf: CPF, resource: 'cardapio', date: '2026-08-28' });
    });

    it('checks the session is still active only after the external fetch resolves', async () => {
        const { sessions, cache, events } = buildDeps();
        const callOrder: string[] = [];
        let resolveFetch!: (value: unknown) => void;
        const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
        (sessions.assertActive as any).mockImplementation(() => { callOrder.push('assertActive'); return Promise.resolve(); });

        const service = new CacheAndPublishScrapedResource(sessions, cache, events);
        const runPromise = service.run('discente', CPF, fetchPromise.then((value) => { callOrder.push('fetchResolved'); return value; }));

        expect(sessions.assertActive).not.toHaveBeenCalled();
        resolveFetch({ studentId: 1 });
        await runPromise;

        expect(callOrder).toEqual(['fetchResolved', 'assertActive']);
    });

    it('propagates a session-invalidated error without caching or publishing anything', async () => {
        const { sessions, cache, events } = buildDeps();
        (sessions.assertActive as any).mockRejectedValue(new Error('Sua sessao do RU Digital expirou. Entre novamente.'));

        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        await expect(service.run('saldo', CPF, Promise.resolve({}))).rejects.toThrow('Sua sessao do RU Digital expirou. Entre novamente.');
        expect(cache.save).not.toHaveBeenCalled();
        expect(events.publishReady).not.toHaveBeenCalled();
    });

    it('propagates a failed external fetch without ever checking the session or caching', async () => {
        const { sessions, cache, events } = buildDeps();
        const service = new CacheAndPublishScrapedResource(sessions, cache, events);

        await expect(service.run('saldo', CPF, Promise.reject(new Error('RU Digital returned HTTP 500.')))).rejects.toThrow('RU Digital returned HTTP 500.');
        expect(sessions.assertActive).not.toHaveBeenCalled();
        expect(cache.save).not.toHaveBeenCalled();
    });
});

import { describe, expect, it, vi } from 'vitest';
import { ReportRuDigitalScrapeFailureUseCase } from '@/application/use-cases/report-ru-digital-scrape-failure.usecase';
import type { RuDigitalCacheStore } from '@/application/ports/ru-digital-cache-store';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalScrapeEventPublisher } from '@/application/ports/ru-digital-scrape-event-publisher';

const CREDENTIALS = { cpf: '06124555212', token: 'jwt' };

function buildDeps() {
    const cache = { save: vi.fn(), get: vi.fn(), clearUserCache: vi.fn() } as unknown as RuDigitalCacheStore;
    const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
    const events = { publishReady: vi.fn(), publishFailed: vi.fn(), publishLoginReady: vi.fn(), publishLoginFailed: vi.fn() } as unknown as RuDigitalScrapeEventPublisher;
    return { cache, sessions, events };
}

describe('ReportRuDigitalScrapeFailureUseCase', () => {
    it.each([
        ['student', 'discente'],
        ['balance', 'saldo'],
        ['daily-menu', 'cardapio'],
        ['default-restaurant', 'restaurante'],
        ['last-consumption', 'ultimo-consumo'],
        ['restaurant-list', 'restaurantes']
    ])('publishes a failed event mapping the "%s" job name to the "%s" cached resource', async (jobName, resource) => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportRuDigitalScrapeFailureUseCase(cache, sessions, events);
        const error = new Error('RU Digital returned HTTP 500.');

        const published = await useCase.execute(jobName, { credentials: CREDENTIALS }, error);

        expect(published).toBe(true);
        expect(events.publishFailed).toHaveBeenCalledWith({
            cpf: CREDENTIALS.cpf,
            resource,
            status: 'failed',
            errorName: error.name,
            message: error.message
        });
    });

    it('includes the date in the published event for a date-scoped job', async () => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportRuDigitalScrapeFailureUseCase(cache, sessions, events);

        await useCase.execute('daily-menu', { credentials: CREDENTIALS, date: '2026-08-28' }, new Error('boom'));

        expect(events.publishFailed).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-08-28' }));
    });

    it('clears the cache and invalidates the session on an authentication failure', async () => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportRuDigitalScrapeFailureUseCase(cache, sessions, events);
        const error = new Error('Sua sessao do RU Digital expirou. Entre novamente.');
        error.name = 'AuthenticationError';

        await useCase.execute('balance', { credentials: CREDENTIALS }, error);

        expect(cache.clearUserCache).toHaveBeenCalledWith(CREDENTIALS.cpf);
        expect(sessions.markInvalid).toHaveBeenCalledWith(CREDENTIALS.cpf, 'authentication-failure');
    });

    it('does not touch the cache or session for a non-authentication failure', async () => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportRuDigitalScrapeFailureUseCase(cache, sessions, events);

        await useCase.execute('balance', { credentials: CREDENTIALS }, new Error('RestaurantNotSelectedError'));

        expect(cache.clearUserCache).not.toHaveBeenCalled();
        expect(sessions.markInvalid).not.toHaveBeenCalled();
    });

    it('returns false and publishes nothing for an unrecognized job name (e.g. "login")', async () => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportRuDigitalScrapeFailureUseCase(cache, sessions, events);

        const published = await useCase.execute('login', { cpf: CREDENTIALS.cpf, password: 'secret' }, new Error('boom'));

        expect(published).toBe(false);
        expect(events.publishFailed).not.toHaveBeenCalled();
    });

    it('returns false when the job data has no credentials (defensive, should not happen for cacheable jobs)', async () => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportRuDigitalScrapeFailureUseCase(cache, sessions, events);

        const published = await useCase.execute('balance', { cpf: CREDENTIALS.cpf, password: 'secret' } as any, new Error('boom'));

        expect(published).toBe(false);
    });
});

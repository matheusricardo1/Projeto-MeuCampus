import { describe, expect, it, vi } from 'vitest';
import { ReportMoodleSyncFailureUseCase } from '@/application/use-cases/report-moodle-sync-failure.usecase';
import type { MoodleCacheStore } from '@/application/ports/moodle-cache-store';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';
import type { MoodleScrapeEventPublisher } from '@/application/ports/moodle-scrape-event-publisher';

const CREDENTIALS = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1', session: { token: 'wstoken-abc' } };

function buildDeps() {
    const cache = { save: vi.fn(), get: vi.fn(), clearUserCache: vi.fn() } as unknown as MoodleCacheStore;
    const sessions = { markActive: vi.fn(), markInvalid: vi.fn(), assertActive: vi.fn() } as unknown as MoodleSessionStore;
    const events = { publishReady: vi.fn(), publishFailed: vi.fn(), publishLoginReady: vi.fn(), publishLoginFailed: vi.fn() } as unknown as MoodleScrapeEventPublisher;
    return { cache, sessions, events };
}

describe('ReportMoodleSyncFailureUseCase', () => {
    it('publishes a failed event for a cacheable resource job carrying credentials', async () => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportMoodleSyncFailureUseCase(cache, sessions, events);
        const error = new Error('Moodle timed out');
        error.name = 'ExternalServiceError';

        const published = await useCase.execute('courses', { credentials: CREDENTIALS }, error);

        expect(published).toBe(true);
        expect(events.publishFailed).toHaveBeenCalledWith({
            identity: 'icomp-colab:matheusricardo1',
            resource: 'courses',
            status: 'failed',
            errorName: 'ExternalServiceError',
            message: 'Moodle timed out'
        });
    });

    it('clears the cache and invalidates the session on an AuthenticationError, in addition to publishing', async () => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportMoodleSyncFailureUseCase(cache, sessions, events);
        const error = new Error('Sua sessao do Moodle expirou. Entre novamente.');
        error.name = 'AuthenticationError';

        await useCase.execute('timeline', { credentials: CREDENTIALS }, error);

        expect(cache.clearUserCache).toHaveBeenCalledWith('icomp-colab:matheusricardo1');
        expect(sessions.markInvalid).toHaveBeenCalledWith('icomp-colab:matheusricardo1', 'authentication-failure');
        expect(events.publishFailed).toHaveBeenCalled();
    });

    it('does not clear the cache for a non-authentication failure', async () => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportMoodleSyncFailureUseCase(cache, sessions, events);
        const error = new Error('network blip');

        await useCase.execute('courses', { credentials: CREDENTIALS }, error);

        expect(cache.clearUserCache).not.toHaveBeenCalled();
        expect(sessions.markInvalid).not.toHaveBeenCalled();
    });

    it('returns false and publishes nothing for a job name that is not a cacheable resource (e.g. "login")', async () => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportMoodleSyncFailureUseCase(cache, sessions, events);

        const published = await useCase.execute('login', { instanceId: 'icomp-colab', username: 'matheusricardo1', password: 'secret' }, new Error('boom'));

        expect(published).toBe(false);
        expect(events.publishFailed).not.toHaveBeenCalled();
    });

    it('returns false when the job data has no credentials to key the event by', async () => {
        const { cache, sessions, events } = buildDeps();
        const useCase = new ReportMoodleSyncFailureUseCase(cache, sessions, events);

        const published = await useCase.execute('courses', { instanceId: 'icomp-colab', username: 'matheusricardo1', password: 'secret' } as any, new Error('boom'));

        expect(published).toBe(false);
        expect(events.publishFailed).not.toHaveBeenCalled();
    });
});

import { describe, expect, it, vi } from 'vitest';
import { LogoutMoodleSessionUseCase } from '@/application/use-cases/logout-moodle-session.usecase';
import type { MoodleRepository } from '@/domain/repositories/moodle.repository';
import type { MoodleCacheStore } from '@/application/ports/moodle-cache-store';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';

const CREDENTIALS = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1', session: { token: 'wstoken-abc' } };

function buildDeps() {
    const repository = { logout: vi.fn(), getCourses: vi.fn(), getTimeline: vi.fn() } as unknown as MoodleRepository;
    const cache = { save: vi.fn(), get: vi.fn(), clearUserCache: vi.fn().mockResolvedValue(3) } as unknown as MoodleCacheStore;
    const sessions = { markActive: vi.fn(), markInvalid: vi.fn(), assertActive: vi.fn() } as unknown as MoodleSessionStore;
    return { repository, cache, sessions };
}

describe('LogoutMoodleSessionUseCase', () => {
    it('logs out remotely, clears the cache, and invalidates the session', async () => {
        const { repository, cache, sessions } = buildDeps();
        const useCase = new LogoutMoodleSessionUseCase(repository, cache, sessions);

        const result = await useCase.execute(CREDENTIALS);

        expect(repository.logout).toHaveBeenCalledWith(CREDENTIALS);
        expect(cache.clearUserCache).toHaveBeenCalledWith('icomp-colab:matheusricardo1');
        expect(sessions.markInvalid).toHaveBeenCalledWith('icomp-colab:matheusricardo1', 'logout');
        expect(result).toEqual({ cacheDeletedKeys: 3, externalLogout: 'ok' });
    });

    it('still clears the cache and invalidates the session when the remote logout fails', async () => {
        const { repository, cache, sessions } = buildDeps();
        (repository.logout as any).mockRejectedValue(new Error('network error'));
        const useCase = new LogoutMoodleSessionUseCase(repository, cache, sessions);

        const result = await useCase.execute(CREDENTIALS);

        expect(cache.clearUserCache).toHaveBeenCalledWith('icomp-colab:matheusricardo1');
        expect(sessions.markInvalid).toHaveBeenCalledWith('icomp-colab:matheusricardo1', 'logout');
        expect(result).toEqual({ cacheDeletedKeys: 3, externalLogout: 'failed' });
    });
});

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { NOT_LINKED, ResolveMoodleSessionForAiUseCase } from '@moodle/application/use-cases/resolve-moodle-session-for-ai.usecase';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { MoodleAccountLinkRepository } from '@moodle/domain/repositories/moodle-account-link.repository';
import type { MoodleSessionRegistry } from '@moodle/application/ports/moodle-session-registry';

beforeAll(() => {
    process.env.ECAMPUS_JWT_SECRET = process.env.ECAMPUS_JWT_SECRET || 'unit-test-secret-do-not-use-in-prod';
});

function buildDeps() {
    const accountLinks = { link: vi.fn(), unlink: vi.fn(), listByUser: vi.fn(), findCredentials: vi.fn(), findFirstCredentials: vi.fn() } as unknown as MoodleAccountLinkRepository;
    const scrapingJobService = { enqueue: vi.fn() } as unknown as ScrapingJobService;
    const sessions = { activate: vi.fn(), invalidate: vi.fn(), isActive: vi.fn() } as unknown as MoodleSessionRegistry;
    return { accountLinks, scrapingJobService, sessions };
}

describe('ResolveMoodleSessionForAiUseCase', () => {
    it('returns NOT_LINKED without attempting any login when no instanceId is given and nothing is linked', async () => {
        const { accountLinks, scrapingJobService, sessions } = buildDeps();
        (accountLinks.findFirstCredentials as any).mockResolvedValue(null);

        const useCase = new ResolveMoodleSessionForAiUseCase(accountLinks, scrapingJobService, sessions);
        const result = await useCase.execute('12345678900');

        expect(result).toBe(NOT_LINKED);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('returns NOT_LINKED when a specific instanceId is given but not linked for this student', async () => {
        const { accountLinks, scrapingJobService, sessions } = buildDeps();
        (accountLinks.findCredentials as any).mockResolvedValue(null);

        const useCase = new ResolveMoodleSessionForAiUseCase(accountLinks, scrapingJobService, sessions);
        const result = await useCase.execute('12345678900', 'colabweb');

        expect(result).toBe(NOT_LINKED);
        expect(accountLinks.findCredentials).toHaveBeenCalledWith(expect.any(String), 'colabweb');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('silently re-logs in with the stored credential and activates the session — "simulated SSO"', async () => {
        const { accountLinks, scrapingJobService, sessions } = buildDeps();
        (accountLinks.findFirstCredentials as any).mockResolvedValue({ instanceId: 'icomp-colab', username: 'matheusricardo1', password: 'stored-secret' });
        const session = { token: 'wstoken-abc', userId: 140 };
        const waitUntilFinished = vi.fn().mockResolvedValue({ session });
        (scrapingJobService.enqueue as any).mockResolvedValue({ id: 'job-1', waitUntilFinished });

        const useCase = new ResolveMoodleSessionForAiUseCase(accountLinks, scrapingJobService, sessions);
        const result = await useCase.execute('12345678900');

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('login', { instanceId: 'icomp-colab', username: 'matheusricardo1', password: 'stored-secret' });
        expect(sessions.activate).toHaveBeenCalledWith({ instanceId: 'icomp-colab', username: 'matheusricardo1', session });
        expect(result).toEqual({ instanceId: 'icomp-colab', username: 'matheusricardo1', session });
    });

    it('uses findCredentials (not findFirstCredentials) when a specific instanceId is requested', async () => {
        const { accountLinks, scrapingJobService, sessions } = buildDeps();
        (accountLinks.findCredentials as any).mockResolvedValue({ username: 'matheusricardo1', password: 'stored-secret' });
        const waitUntilFinished = vi.fn().mockResolvedValue({ session: { token: 'x' } });
        (scrapingJobService.enqueue as any).mockResolvedValue({ id: 'job-1', waitUntilFinished });

        const useCase = new ResolveMoodleSessionForAiUseCase(accountLinks, scrapingJobService, sessions);
        await useCase.execute('12345678900', 'colabweb');

        expect(accountLinks.findFirstCredentials).not.toHaveBeenCalled();
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('login', { instanceId: 'colabweb', username: 'matheusricardo1', password: 'stored-secret' });
    });
});

import { describe, expect, it, vi } from 'vitest';
import { LoginMoodleSessionUseCase } from '@/application/use-cases/login-moodle-session.usecase';
import type { MoodleAuthenticator } from '@/application/ports/moodle-authenticator';
import type { MoodleScrapeEventPublisher } from '@/application/ports/moodle-scrape-event-publisher';
import type { MoodleSessionStore } from '@/application/ports/moodle-session-store';

function buildDeps() {
    const authenticator = { authenticate: vi.fn() } as unknown as MoodleAuthenticator;
    const sessions = { markActive: vi.fn(), markInvalid: vi.fn(), assertActive: vi.fn() } as unknown as MoodleSessionStore;
    const events = {
        publishReady: vi.fn(),
        publishFailed: vi.fn(),
        publishLoginReady: vi.fn().mockResolvedValue(undefined),
        publishLoginFailed: vi.fn().mockResolvedValue(undefined)
    } as unknown as MoodleScrapeEventPublisher;
    return { authenticator, sessions, events };
}

describe('LoginMoodleSessionUseCase', () => {
    it('authenticates, marks the session active, and returns the session without a jobId', async () => {
        const { authenticator, sessions, events } = buildDeps();
        const session = { token: 'wstoken-abc', userId: 140 };
        (authenticator.authenticate as any).mockResolvedValue(session);

        const useCase = new LoginMoodleSessionUseCase(authenticator, sessions, events);
        const result = await useCase.execute('icomp-colab', 'matheusricardo1', 'secret');

        expect(authenticator.authenticate).toHaveBeenCalledWith({ instanceId: 'icomp-colab', username: 'matheusricardo1' }, 'secret');
        expect(sessions.markActive).toHaveBeenCalledWith('icomp-colab:matheusricardo1');
        expect(result).toEqual({ session });
        expect(events.publishLoginReady).not.toHaveBeenCalled();
    });

    it('publishes a login-ready event carrying the identity when a jobId is given', async () => {
        const { authenticator, sessions, events } = buildDeps();
        const session = { token: 'wstoken-abc', userId: 140 };
        (authenticator.authenticate as any).mockResolvedValue(session);

        const useCase = new LoginMoodleSessionUseCase(authenticator, sessions, events);
        await useCase.execute('colabweb', 'matheusricardo1', 'secret', 'job-1');

        expect(events.publishLoginReady).toHaveBeenCalledWith({
            type: 'login',
            jobId: 'job-1',
            identity: 'colabweb:matheusricardo1',
            session
        });
    });

    it('publishes a login-failed event and rethrows when authentication fails and a jobId is given', async () => {
        const { authenticator, sessions, events } = buildDeps();
        const error = new Error('Identificacao ou senha invalidas.');
        error.name = 'AuthenticationError';
        (authenticator.authenticate as any).mockRejectedValue(error);

        const useCase = new LoginMoodleSessionUseCase(authenticator, sessions, events);

        await expect(useCase.execute('icomp-colab', 'matheusricardo1', 'wrong', 'job-2')).rejects.toThrow('Identificacao ou senha invalidas.');

        expect(sessions.markActive).not.toHaveBeenCalled();
        expect(events.publishLoginFailed).toHaveBeenCalledWith({
            type: 'login',
            status: 'failed',
            jobId: 'job-2',
            identity: 'icomp-colab:matheusricardo1',
            errorName: 'AuthenticationError',
            message: 'Identificacao ou senha invalidas.'
        });
    });

    it('still rejects when authentication fails without a jobId, without publishing anything', async () => {
        const { authenticator, sessions, events } = buildDeps();
        (authenticator.authenticate as any).mockRejectedValue(new Error('boom'));

        const useCase = new LoginMoodleSessionUseCase(authenticator, sessions, events);

        await expect(useCase.execute('icomp-colab', 'matheusricardo1', 'wrong')).rejects.toThrow('boom');
        expect(events.publishLoginFailed).not.toHaveBeenCalled();
    });
});

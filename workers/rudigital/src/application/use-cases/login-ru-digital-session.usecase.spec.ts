import { describe, expect, it, vi } from 'vitest';
import { LoginRuDigitalSessionUseCase } from '@/application/use-cases/login-ru-digital-session.usecase';
import type { RuDigitalAuthenticator } from '@/application/ports/ru-digital-authenticator';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalScrapeEventPublisher } from '@/application/ports/ru-digital-scrape-event-publisher';

const CPF = '06124555212';

function buildDeps() {
    const authenticator = { authenticate: vi.fn() } as unknown as RuDigitalAuthenticator;
    const sessions = { markActive: vi.fn(), markInvalid: vi.fn(), assertActive: vi.fn() } as unknown as RuDigitalSessionStore;
    const events = {
        publishReady: vi.fn(),
        publishFailed: vi.fn(),
        publishLoginReady: vi.fn().mockResolvedValue(undefined),
        publishLoginFailed: vi.fn().mockResolvedValue(undefined)
    } as unknown as RuDigitalScrapeEventPublisher;
    return { authenticator, sessions, events };
}

describe('LoginRuDigitalSessionUseCase', () => {
    it('authenticates, marks the session active, and returns the session', async () => {
        const { authenticator, sessions, events } = buildDeps();
        (authenticator.authenticate as any).mockResolvedValue({ token: 'jwt' });

        const useCase = new LoginRuDigitalSessionUseCase(authenticator, sessions, events);
        const result = await useCase.execute(CPF, 'secret');

        expect(authenticator.authenticate).toHaveBeenCalledWith({ cpf: CPF }, 'secret');
        expect(sessions.markActive).toHaveBeenCalledWith(CPF);
        expect(result).toEqual({ session: { token: 'jwt' } });
        expect(events.publishLoginReady).not.toHaveBeenCalled();
    });

    it('publishes a login-ready event when a jobId is provided', async () => {
        const { authenticator, sessions, events } = buildDeps();
        (authenticator.authenticate as any).mockResolvedValue({ token: 'jwt' });

        const useCase = new LoginRuDigitalSessionUseCase(authenticator, sessions, events);
        await useCase.execute(CPF, 'secret', 'job-1');

        expect(events.publishLoginReady).toHaveBeenCalledWith({ type: 'login', jobId: 'job-1', cpf: CPF, session: { token: 'jwt' } });
    });

    it('publishes a login-failed event and rethrows when authentication fails and a jobId is provided', async () => {
        const { authenticator, sessions, events } = buildDeps();
        const error = new Error('CPF ou senha invalidos.');
        error.name = 'AuthenticationError';
        (authenticator.authenticate as any).mockRejectedValue(error);

        const useCase = new LoginRuDigitalSessionUseCase(authenticator, sessions, events);

        await expect(useCase.execute(CPF, 'wrong', 'job-1')).rejects.toThrow('CPF ou senha invalidos.');
        expect(events.publishLoginFailed).toHaveBeenCalledWith({
            type: 'login',
            status: 'failed',
            jobId: 'job-1',
            cpf: CPF,
            errorName: 'AuthenticationError',
            message: 'CPF ou senha invalidos.'
        });
        expect(sessions.markActive).not.toHaveBeenCalled();
    });

    it('does not attempt to publish a failure event when no jobId was given', async () => {
        const { authenticator, sessions, events } = buildDeps();
        (authenticator.authenticate as any).mockRejectedValue(new Error('boom'));

        const useCase = new LoginRuDigitalSessionUseCase(authenticator, sessions, events);

        await expect(useCase.execute(CPF, 'wrong')).rejects.toThrow('boom');
        expect(events.publishLoginFailed).not.toHaveBeenCalled();
    });

    it('still rejects even if publishing the failure event itself throws', async () => {
        const { authenticator, sessions, events } = buildDeps();
        (authenticator.authenticate as any).mockRejectedValue(new Error('boom'));
        (events.publishLoginFailed as any).mockRejectedValue(new Error('redis down'));

        const useCase = new LoginRuDigitalSessionUseCase(authenticator, sessions, events);

        await expect(useCase.execute(CPF, 'wrong', 'job-1')).rejects.toThrow('boom');
    });
});

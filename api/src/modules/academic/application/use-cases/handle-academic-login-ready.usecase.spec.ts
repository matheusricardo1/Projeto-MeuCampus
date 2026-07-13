import { describe, expect, it, vi } from 'vitest';
import { HandleAcademicLoginReadyUseCase } from '@academic/application/use-cases/handle-academic-login-ready.usecase';
import type { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import type { AccessTokenService } from '@auth/application/ports/access-token-service';
import type { AcademicNotificationService } from '@academic/application/ports/academic-notification-service';
import type { PrefetchAcademicDataUseCase } from '@academic/application/use-cases/prefetch-academic-data.usecase';

function buildDeps() {
    const sessionRegistry = { activate: vi.fn().mockResolvedValue(undefined) } as unknown as AcademicSessionRegistry;
    const accessTokenService = { sign: vi.fn().mockReturnValue('signed-token') } as unknown as AccessTokenService;
    const notifier = {
        revokeUserSessions: vi.fn(),
        emitLoginReady: vi.fn()
    } as unknown as AcademicNotificationService;
    const prefetchUseCase = { execute: vi.fn().mockResolvedValue(undefined) } as unknown as PrefetchAcademicDataUseCase;
    return { sessionRegistry, accessTokenService, notifier, prefetchUseCase };
}

const EVENT = { jobId: 'job-1', cpf: '12345678900', session: { token: 'raw' } };

describe('HandleAcademicLoginReadyUseCase', () => {
    it('activates the session, revokes stale sockets, signs an access token, and emits login-ready', async () => {
        const { sessionRegistry, accessTokenService, notifier, prefetchUseCase } = buildDeps();
        const useCase = new HandleAcademicLoginReadyUseCase(sessionRegistry, accessTokenService, notifier, prefetchUseCase);

        await useCase.execute(EVENT);

        expect(sessionRegistry.activate).toHaveBeenCalledWith({ cpf: '12345678900', session: { token: 'raw' } });
        expect(notifier.revokeUserSessions).toHaveBeenCalledWith('12345678900');
        expect(accessTokenService.sign).toHaveBeenCalledWith({ cpf: '12345678900', session: { token: 'raw' } });
        expect(notifier.emitLoginReady).toHaveBeenCalledWith({ jobId: 'job-1', accessToken: 'signed-token' });
    });

    it('triggers prefetch in the background without awaiting it', async () => {
        const { sessionRegistry, accessTokenService, notifier, prefetchUseCase } = buildDeps();
        let resolvePrefetch!: () => void;
        (prefetchUseCase.execute as any).mockReturnValue(new Promise<void>((resolve) => { resolvePrefetch = resolve; }));

        const useCase = new HandleAcademicLoginReadyUseCase(sessionRegistry, accessTokenService, notifier, prefetchUseCase);

        // execute() resolves even though the prefetch promise is still pending.
        await useCase.execute(EVENT);
        expect(prefetchUseCase.execute).toHaveBeenCalledWith({ cpf: '12345678900', session: { token: 'raw' } });

        resolvePrefetch();
    });

    it('swallows a prefetch failure instead of rejecting execute()', async () => {
        const { sessionRegistry, accessTokenService, notifier, prefetchUseCase } = buildDeps();
        let rejectPrefetch!: (error: Error) => void;
        (prefetchUseCase.execute as any).mockReturnValue(new Promise((_resolve, reject) => { rejectPrefetch = reject; }));

        const useCase = new HandleAcademicLoginReadyUseCase(sessionRegistry, accessTokenService, notifier, prefetchUseCase);

        await expect(useCase.execute(EVENT)).resolves.toBeUndefined();

        rejectPrefetch(new Error('worker unreachable'));
        // Let the rejection's .catch() handler run without this test itself throwing.
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
});

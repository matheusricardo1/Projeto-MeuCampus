import { describe, expect, it, vi } from 'vitest';
import { HandleAcademicResourceFailedUseCase } from '@academic/application/use-cases/handle-academic-resource-failed.usecase';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import type { AcademicBootstrapTracker, AcademicBootstrapState } from '@academic/application/ports/academic-bootstrap-tracker';
import type { AcademicNotificationService, AcademicResourceFailedNotification } from '@academic/application/ports/academic-notification-service';

function buildEvent(overrides: Partial<AcademicResourceFailedNotification> = {}): AcademicResourceFailedNotification {
    return {
        cpf: '12345678900',
        resource: 'grades',
        status: 'failed',
        errorName: 'ScrapeError',
        message: 'boom',
        ...overrides
    };
}

function buildDeps() {
    const academicDataRepository = { clearUserCache: vi.fn().mockResolvedValue(0) } as unknown as AcademicDataRepository;
    const sessionRegistry = { invalidate: vi.fn().mockResolvedValue(undefined) } as unknown as AcademicSessionRegistry;
    const bootstrapTracker = { markFailed: vi.fn().mockResolvedValue(null) } as unknown as AcademicBootstrapTracker;
    const notifier = { emitBootstrapFailed: vi.fn(), emitResourceFailed: vi.fn() } as unknown as AcademicNotificationService;
    return { academicDataRepository, sessionRegistry, bootstrapTracker, notifier };
}

describe('HandleAcademicResourceFailedUseCase', () => {
    it('always emits resource-failed for the individual resource', async () => {
        const { academicDataRepository, sessionRegistry, bootstrapTracker, notifier } = buildDeps();
        const event = buildEvent();
        const useCase = new HandleAcademicResourceFailedUseCase(academicDataRepository, sessionRegistry, bootstrapTracker, notifier);

        await useCase.execute(event);

        expect(notifier.emitResourceFailed).toHaveBeenCalledWith(event);
    });

    it('clears the user cache and invalidates the session when the failure is an authentication error', async () => {
        const { academicDataRepository, sessionRegistry, bootstrapTracker, notifier } = buildDeps();
        const event = buildEvent({ errorName: 'AuthenticationError' });
        const useCase = new HandleAcademicResourceFailedUseCase(academicDataRepository, sessionRegistry, bootstrapTracker, notifier);

        await useCase.execute(event);

        expect(academicDataRepository.clearUserCache).toHaveBeenCalledWith('12345678900');
        expect(sessionRegistry.invalidate).toHaveBeenCalledWith('12345678900');
    });

    it('does not touch the cache or session for a non-authentication failure', async () => {
        const { academicDataRepository, sessionRegistry, bootstrapTracker, notifier } = buildDeps();
        const event = buildEvent({ errorName: 'TimeoutError' });
        const useCase = new HandleAcademicResourceFailedUseCase(academicDataRepository, sessionRegistry, bootstrapTracker, notifier);

        await useCase.execute(event);

        expect(academicDataRepository.clearUserCache).not.toHaveBeenCalled();
        expect(sessionRegistry.invalidate).not.toHaveBeenCalled();
    });

    it('emits bootstrap-failed once marking this resource failed completes the bootstrap set as failed', async () => {
        const { academicDataRepository, sessionRegistry, bootstrapTracker, notifier } = buildDeps();
        const state: AcademicBootstrapState = {
            cpf: '12345678900',
            status: 'failed',
            requiredResources: ['profile', 'grades'],
            readyResources: ['profile'],
            failedResources: ['grades'],
            startedAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:01.000Z'
        };
        (bootstrapTracker.markFailed as any).mockResolvedValue(state);

        const useCase = new HandleAcademicResourceFailedUseCase(academicDataRepository, sessionRegistry, bootstrapTracker, notifier);
        await useCase.execute(buildEvent());

        expect(notifier.emitBootstrapFailed).toHaveBeenCalledWith({
            cpf: '12345678900',
            requiredResources: ['profile', 'grades'],
            readyResources: ['profile'],
            failedResources: ['grades']
        });
    });

    it('does not emit bootstrap-failed while the bootstrap set is still pending', async () => {
        const { academicDataRepository, sessionRegistry, bootstrapTracker, notifier } = buildDeps();
        const state: AcademicBootstrapState = {
            cpf: '12345678900',
            status: 'pending',
            requiredResources: ['profile', 'grades'],
            readyResources: [],
            failedResources: ['grades'],
            startedAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:01.000Z'
        };
        (bootstrapTracker.markFailed as any).mockResolvedValue(state);

        const useCase = new HandleAcademicResourceFailedUseCase(academicDataRepository, sessionRegistry, bootstrapTracker, notifier);
        await useCase.execute(buildEvent());

        expect(notifier.emitBootstrapFailed).not.toHaveBeenCalled();
    });
});

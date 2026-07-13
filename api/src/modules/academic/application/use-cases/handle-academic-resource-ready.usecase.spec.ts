import { describe, expect, it, vi } from 'vitest';
import { HandleAcademicResourceReadyUseCase } from '@academic/application/use-cases/handle-academic-resource-ready.usecase';
import type { AcademicBootstrapTracker, AcademicBootstrapState } from '@academic/application/ports/academic-bootstrap-tracker';
import type { AcademicNotificationService, AcademicResourceNotification } from '@academic/application/ports/academic-notification-service';

const EVENT: AcademicResourceNotification = { cpf: '12345678900', resource: 'grades' };

function buildState(overrides: Partial<AcademicBootstrapState> = {}): AcademicBootstrapState {
    return {
        cpf: '12345678900',
        status: 'pending',
        requiredResources: ['profile', 'grades'],
        readyResources: ['grades'],
        failedResources: [],
        startedAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:01.000Z',
        ...overrides
    };
}

describe('HandleAcademicResourceReadyUseCase', () => {
    it('always emits resource-ready for the individual resource', async () => {
        const bootstrapTracker = { markReady: vi.fn().mockResolvedValue(null) } as unknown as AcademicBootstrapTracker;
        const notifier = { emitResourceReady: vi.fn(), emitBootstrapReady: vi.fn(), emitBootstrapFailed: vi.fn() } as unknown as AcademicNotificationService;

        const useCase = new HandleAcademicResourceReadyUseCase(bootstrapTracker, notifier);
        await useCase.execute(EVENT);

        expect(notifier.emitResourceReady).toHaveBeenCalledWith(EVENT);
    });

    it('does not emit a bootstrap event when the tracker has no bootstrap set for this cpf', async () => {
        const bootstrapTracker = { markReady: vi.fn().mockResolvedValue(null) } as unknown as AcademicBootstrapTracker;
        const notifier = { emitResourceReady: vi.fn(), emitBootstrapReady: vi.fn(), emitBootstrapFailed: vi.fn() } as unknown as AcademicNotificationService;

        const useCase = new HandleAcademicResourceReadyUseCase(bootstrapTracker, notifier);
        await useCase.execute(EVENT);

        expect(notifier.emitBootstrapReady).not.toHaveBeenCalled();
        expect(notifier.emitBootstrapFailed).not.toHaveBeenCalled();
    });

    it('emits bootstrap-ready when marking this resource ready completes the whole bootstrap set', async () => {
        const state = buildState({ status: 'ready', readyResources: ['profile', 'grades'] });
        const bootstrapTracker = { markReady: vi.fn().mockResolvedValue(state) } as unknown as AcademicBootstrapTracker;
        const notifier = { emitResourceReady: vi.fn(), emitBootstrapReady: vi.fn(), emitBootstrapFailed: vi.fn() } as unknown as AcademicNotificationService;

        const useCase = new HandleAcademicResourceReadyUseCase(bootstrapTracker, notifier);
        await useCase.execute(EVENT);

        expect(notifier.emitBootstrapReady).toHaveBeenCalledWith({
            cpf: '12345678900',
            requiredResources: ['profile', 'grades'],
            readyResources: ['profile', 'grades'],
            failedResources: []
        });
        expect(notifier.emitBootstrapFailed).not.toHaveBeenCalled();
    });

    it('emits bootstrap-failed when this success completes a set that already had a failure elsewhere', async () => {
        const state = buildState({ status: 'failed', failedResources: ['schedule'] });
        const bootstrapTracker = { markReady: vi.fn().mockResolvedValue(state) } as unknown as AcademicBootstrapTracker;
        const notifier = { emitResourceReady: vi.fn(), emitBootstrapReady: vi.fn(), emitBootstrapFailed: vi.fn() } as unknown as AcademicNotificationService;

        const useCase = new HandleAcademicResourceReadyUseCase(bootstrapTracker, notifier);
        await useCase.execute(EVENT);

        expect(notifier.emitBootstrapFailed).toHaveBeenCalledWith({
            cpf: '12345678900',
            requiredResources: ['profile', 'grades'],
            readyResources: ['grades'],
            failedResources: ['schedule']
        });
        expect(notifier.emitBootstrapReady).not.toHaveBeenCalled();
    });

    it('emits no bootstrap event while the bootstrap set is still pending', async () => {
        const state = buildState({ status: 'pending' });
        const bootstrapTracker = { markReady: vi.fn().mockResolvedValue(state) } as unknown as AcademicBootstrapTracker;
        const notifier = { emitResourceReady: vi.fn(), emitBootstrapReady: vi.fn(), emitBootstrapFailed: vi.fn() } as unknown as AcademicNotificationService;

        const useCase = new HandleAcademicResourceReadyUseCase(bootstrapTracker, notifier);
        await useCase.execute(EVENT);

        expect(notifier.emitBootstrapReady).not.toHaveBeenCalled();
        expect(notifier.emitBootstrapFailed).not.toHaveBeenCalled();
    });
});

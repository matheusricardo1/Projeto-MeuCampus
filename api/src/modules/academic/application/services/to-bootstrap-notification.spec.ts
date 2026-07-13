import { describe, expect, it } from 'vitest';
import { toBootstrapNotification } from '@academic/application/services/to-bootstrap-notification';
import type { AcademicBootstrapState } from '@academic/application/ports/academic-bootstrap-tracker';

describe('toBootstrapNotification', () => {
    it('projects only the notification-relevant fields from the bootstrap state', () => {
        const state: AcademicBootstrapState = {
            cpf: '12345678900',
            status: 'ready',
            requiredResources: ['profile', 'grades'],
            readyResources: ['profile', 'grades'],
            failedResources: [],
            startedAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:05.000Z'
        };

        expect(toBootstrapNotification(state)).toEqual({
            cpf: '12345678900',
            requiredResources: ['profile', 'grades'],
            readyResources: ['profile', 'grades'],
            failedResources: []
        });
    });

    it('does not leak status/startedAt/updatedAt into the notification', () => {
        const state: AcademicBootstrapState = {
            cpf: '12345678900',
            status: 'failed',
            requiredResources: ['schedule'],
            readyResources: [],
            failedResources: ['schedule'],
            startedAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:05.000Z'
        };

        const notification = toBootstrapNotification(state);
        expect(notification).not.toHaveProperty('status');
        expect(notification).not.toHaveProperty('startedAt');
        expect(notification).not.toHaveProperty('updatedAt');
    });
});

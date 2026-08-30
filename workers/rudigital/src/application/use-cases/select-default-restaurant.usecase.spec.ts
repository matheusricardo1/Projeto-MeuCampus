import { describe, expect, it, vi } from 'vitest';
import { SelectDefaultRestaurantUseCase } from '@/application/use-cases/select-default-restaurant.usecase';
import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';

const CREDENTIALS = { cpf: '06124555212', token: 'jwt' };

describe('SelectDefaultRestaurantUseCase', () => {
    it('asserts the session is active, selects the restaurant, and returns the updated session', async () => {
        const updatedSession = { token: 'jwt', restaurantId: 'MAO' };
        const repository = { selectDefaultRestaurant: vi.fn().mockResolvedValue(updatedSession) } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;

        const useCase = new SelectDefaultRestaurantUseCase(repository, sessions);
        const result = await useCase.execute(CREDENTIALS, 'MAO');

        expect(sessions.assertActive).toHaveBeenCalledWith(CREDENTIALS.cpf);
        expect(repository.selectDefaultRestaurant).toHaveBeenCalledWith(CREDENTIALS, 'MAO');
        expect(result).toEqual({ session: updatedSession });
    });

    it('propagates a session-invalidated error without calling the repository', async () => {
        const repository = { selectDefaultRestaurant: vi.fn() } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn().mockRejectedValue(new Error('expired')), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;

        const useCase = new SelectDefaultRestaurantUseCase(repository, sessions);

        await expect(useCase.execute(CREDENTIALS, 'MAO')).rejects.toThrow('expired');
        expect(repository.selectDefaultRestaurant).not.toHaveBeenCalled();
    });

    it('propagates a repository failure (e.g. RU Digital rejected the restaurant)', async () => {
        const repository = { selectDefaultRestaurant: vi.fn().mockRejectedValue(new Error('RU Digital returned HTTP 500 while selecting the restaurant.')) } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;

        const useCase = new SelectDefaultRestaurantUseCase(repository, sessions);

        await expect(useCase.execute(CREDENTIALS, 'MAO')).rejects.toThrow('RU Digital returned HTTP 500 while selecting the restaurant.');
    });
});

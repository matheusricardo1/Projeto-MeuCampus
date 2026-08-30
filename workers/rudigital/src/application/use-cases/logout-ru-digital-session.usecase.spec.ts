import { describe, expect, it, vi } from 'vitest';
import { LogoutRuDigitalSessionUseCase } from '@/application/use-cases/logout-ru-digital-session.usecase';
import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalCacheStore } from '@/application/ports/ru-digital-cache-store';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';

const CREDENTIALS = { cpf: '06124555212', token: 'jwt' };

function buildDeps() {
    const repository = { logout: vi.fn() } as unknown as RuDigitalRepository;
    const cache = { save: vi.fn(), get: vi.fn(), clearUserCache: vi.fn() } as unknown as RuDigitalCacheStore;
    const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
    return { repository, cache, sessions };
}

describe('LogoutRuDigitalSessionUseCase', () => {
    it('logs out externally, clears the cache, and invalidates the session', async () => {
        const { repository, cache, sessions } = buildDeps();
        (repository.logout as any).mockResolvedValue(undefined);
        (cache.clearUserCache as any).mockResolvedValue(4);

        const useCase = new LogoutRuDigitalSessionUseCase(repository, cache, sessions);
        const result = await useCase.execute(CREDENTIALS);

        expect(repository.logout).toHaveBeenCalledWith(CREDENTIALS);
        expect(cache.clearUserCache).toHaveBeenCalledWith(CREDENTIALS.cpf);
        expect(sessions.markInvalid).toHaveBeenCalledWith(CREDENTIALS.cpf, 'logout');
        expect(result).toEqual({ cacheDeletedKeys: 4, externalLogout: 'ok' });
    });

    it('still clears the cache and invalidates the session locally even when the external logout call fails', async () => {
        const { repository, cache, sessions } = buildDeps();
        (repository.logout as any).mockRejectedValue(new Error('RU Digital is unreachable.'));
        (cache.clearUserCache as any).mockResolvedValue(2);

        const useCase = new LogoutRuDigitalSessionUseCase(repository, cache, sessions);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ cacheDeletedKeys: 2, externalLogout: 'failed' });
        expect(cache.clearUserCache).toHaveBeenCalledWith(CREDENTIALS.cpf);
        expect(sessions.markInvalid).toHaveBeenCalledWith(CREDENTIALS.cpf, 'logout');
    });
});

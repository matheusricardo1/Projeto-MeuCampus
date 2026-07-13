import { describe, expect, it, vi } from 'vitest';
import { AcademicSessionExpiredException, ValidateAcademicSessionUseCase } from '@academic/application/use-cases/validate-academic-session.usecase';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';

const CREDENTIALS = { cpf: '12345678900' };

describe('ValidateAcademicSessionUseCase', () => {
    it('returns ok without touching the cache when the session is active', async () => {
        const academicDataRepository = { clearUserCache: vi.fn() } as unknown as AcademicDataRepository;
        const sessionRegistry = { isActive: vi.fn().mockResolvedValue(true), invalidate: vi.fn() } as unknown as AcademicSessionRegistry;

        const useCase = new ValidateAcademicSessionUseCase(academicDataRepository, sessionRegistry);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ status: 'ok' });
        expect(academicDataRepository.clearUserCache).not.toHaveBeenCalled();
        expect(sessionRegistry.invalidate).not.toHaveBeenCalled();
    });

    it('clears the cache, invalidates the session, and throws when the session is inactive', async () => {
        const academicDataRepository = { clearUserCache: vi.fn().mockResolvedValue(2) } as unknown as AcademicDataRepository;
        const sessionRegistry = { isActive: vi.fn().mockResolvedValue(false), invalidate: vi.fn().mockResolvedValue(undefined) } as unknown as AcademicSessionRegistry;

        const useCase = new ValidateAcademicSessionUseCase(academicDataRepository, sessionRegistry);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow(AcademicSessionExpiredException);
        expect(academicDataRepository.clearUserCache).toHaveBeenCalledWith('12345678900');
        expect(sessionRegistry.invalidate).toHaveBeenCalledWith('12345678900');
    });
});

describe('AcademicSessionExpiredException', () => {
    it('uses a default Portuguese message', () => {
        expect(new AcademicSessionExpiredException().message).toBe('Sua sessao expirou. Entre novamente.');
    });

    it('accepts a custom message', () => {
        expect(new AcademicSessionExpiredException('custom').message).toBe('custom');
    });
});

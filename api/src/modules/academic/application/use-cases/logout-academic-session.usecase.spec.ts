import { describe, expect, it, vi } from 'vitest';
import { LogoutAcademicSessionUseCase } from '@academic/application/use-cases/logout-academic-session.usecase';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '12345678900' };

function buildDeps() {
    const scrapingJobService = {
        enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn().mockResolvedValue(undefined) })
    } as unknown as ScrapingJobService;
    const academicDataRepository = { clearUserCache: vi.fn().mockResolvedValue(3) } as unknown as AcademicDataRepository;
    const sessionRegistry = { invalidate: vi.fn().mockResolvedValue(undefined) } as unknown as AcademicSessionRegistry;
    return { scrapingJobService, academicDataRepository, sessionRegistry };
}

describe('LogoutAcademicSessionUseCase', () => {
    it('enqueues a logout job, waits for it, then clears cache and invalidates the session', async () => {
        const { scrapingJobService, academicDataRepository, sessionRegistry } = buildDeps();
        const useCase = new LogoutAcademicSessionUseCase(scrapingJobService, academicDataRepository, sessionRegistry);

        await useCase.execute(CREDENTIALS);

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('logout', { credentials: CREDENTIALS });
        expect(academicDataRepository.clearUserCache).toHaveBeenCalledWith('12345678900');
        expect(sessionRegistry.invalidate).toHaveBeenCalledWith('12345678900');
    });

    it('still clears cache and invalidates the session even when the worker job times out or fails', async () => {
        const { scrapingJobService, academicDataRepository, sessionRegistry } = buildDeps();
        (scrapingJobService.enqueue as any).mockResolvedValue({
            id: 'job-1',
            waitUntilFinished: vi.fn().mockRejectedValue(new Error('timed out'))
        });

        const useCase = new LogoutAcademicSessionUseCase(scrapingJobService, academicDataRepository, sessionRegistry);

        await expect(useCase.execute(CREDENTIALS)).resolves.toBeUndefined();
        expect(academicDataRepository.clearUserCache).toHaveBeenCalledWith('12345678900');
        expect(sessionRegistry.invalidate).toHaveBeenCalledWith('12345678900');
    });
});

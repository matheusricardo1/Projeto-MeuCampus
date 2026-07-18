import { describe, expect, it, vi } from 'vitest';
import { GetMatrizCurricularUseCase } from '@academic/application/use-cases/get-matriz-curricular.usecase';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import type { MatrizCurricularCacheRepository } from '@academic/infrastructure/prisma/matriz-curricular-cache.repository';
import type { MatrizCurricular } from '@academic/domain/entities/matriz-curricular.entity';

const CREDENTIALS = { cpf: '12345678900' };

function buildCache(overrides: Partial<AcademicDataRepository> = {}): AcademicDataRepository {
    return {
        getProfile: vi.fn().mockResolvedValue({ academic: { course: 'IE17 - Engenharia de Software' } }),
        getMatrizCurricular: vi.fn().mockRejectedValue(new AcademicResourceNotFoundException('matriz')),
        ...overrides
    } as unknown as AcademicDataRepository;
}

function buildJobs(overrides: Partial<ScrapingJobService> = {}): ScrapingJobService {
    return {
        enqueue: vi.fn().mockResolvedValue({ waitUntilFinished: vi.fn().mockResolvedValue(undefined) }),
        ...overrides
    } as unknown as ScrapingJobService;
}

function buildDbCache(overrides: Partial<MatrizCurricularCacheRepository> = {}): MatrizCurricularCacheRepository {
    return {
        findByCodCurso: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(undefined),
        ...overrides
    } as unknown as MatrizCurricularCacheRepository;
}

const MATRIZ: MatrizCurricular = {
    curso: 'IE17 - Engenharia de Software',
    grau: 'Bacharel',
    turno: 'Integral',
    versao: '2025/2',
    situacao: 'Corrente',
    categorias: [],
    totalDisciplinas: 0
};

describe('GetMatrizCurricularUseCase.requestCachedOrPending', () => {
    it('returns the DB cache hit instantly without touching Redis or enqueueing a scrape', async () => {
        const cache = buildCache();
        const jobs = buildJobs();
        const dbCache = buildDbCache({ findByCodCurso: vi.fn().mockResolvedValue(MATRIZ) });
        const useCase = new GetMatrizCurricularUseCase(cache, jobs, dbCache);

        const result = await useCase.requestCachedOrPending(CREDENTIALS as any);

        expect(result).toBe(MATRIZ);
        expect(dbCache.findByCodCurso).toHaveBeenCalledWith('IE17');
        expect(cache.getMatrizCurricular).not.toHaveBeenCalled();
        expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('on a DB miss, falls back to the Redis cache and backfills the DB cache', async () => {
        const cache = buildCache({ getMatrizCurricular: vi.fn().mockResolvedValue(MATRIZ) });
        const jobs = buildJobs();
        const dbCache = buildDbCache();
        const useCase = new GetMatrizCurricularUseCase(cache, jobs, dbCache);

        const result = await useCase.requestCachedOrPending(CREDENTIALS as any);

        expect(result).toBe(MATRIZ);
        expect(dbCache.upsert).toHaveBeenCalledWith('IE17', MATRIZ);
        expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('on a full miss, enqueues a scrape and returns a pending marker', async () => {
        const cache = buildCache();
        const jobs = buildJobs();
        const dbCache = buildDbCache();
        const useCase = new GetMatrizCurricularUseCase(cache, jobs, dbCache);

        const result = await useCase.requestCachedOrPending(CREDENTIALS as any);

        expect(result).toEqual({ status: 'pending', resource: 'matriz' });
        expect(jobs.enqueue).toHaveBeenCalledWith('matriz-curricular', { credentials: CREDENTIALS }, expect.objectContaining({ dedupeKey: expect.any(String) }));
    });

    it('still works when the profile is not cached yet (falls through to Redis/scrape)', async () => {
        const cache = buildCache({ getProfile: vi.fn().mockRejectedValue(new Error('no profile cached')) });
        const jobs = buildJobs();
        const dbCache = buildDbCache();
        const useCase = new GetMatrizCurricularUseCase(cache, jobs, dbCache);

        const result = await useCase.requestCachedOrPending(CREDENTIALS as any);

        expect(dbCache.findByCodCurso).not.toHaveBeenCalled();
        expect(result).toEqual({ status: 'pending', resource: 'matriz' });
    });
});

describe('GetMatrizCurricularUseCase.execute', () => {
    it('returns the DB cache hit instantly', async () => {
        const cache = buildCache();
        const jobs = buildJobs();
        const dbCache = buildDbCache({ findByCodCurso: vi.fn().mockResolvedValue(MATRIZ) });
        const useCase = new GetMatrizCurricularUseCase(cache, jobs, dbCache);

        const result = await useCase.execute(CREDENTIALS as any);

        expect(result).toBe(MATRIZ);
        expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('waits for a live scrape on a full miss and backfills the DB cache', async () => {
        const cache = buildCache({
            getMatrizCurricular: vi.fn()
                .mockRejectedValueOnce(new AcademicResourceNotFoundException('matriz'))
                .mockResolvedValueOnce(MATRIZ)
        });
        const jobs = buildJobs();
        const dbCache = buildDbCache();
        const useCase = new GetMatrizCurricularUseCase(cache, jobs, dbCache);

        const result = await useCase.execute(CREDENTIALS as any);

        expect(result).toBe(MATRIZ);
        expect(jobs.enqueue).toHaveBeenCalled();
        expect(dbCache.upsert).toHaveBeenCalledWith('IE17', MATRIZ);
    });
});

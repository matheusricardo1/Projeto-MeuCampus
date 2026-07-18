import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { MatrizCurricular } from '@academic/domain/entities/matriz-curricular.entity';
import { extractCourseCode } from '@academic/domain/services/course-code';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import type { MatrizCurricularCacheRepository } from '@academic/infrastructure/prisma/matriz-curricular-cache.repository';

/**
 * Returns the curriculum matrix (matriz curricular). The matrix changes maybe
 * once every 5-10 years, so it's cached PERSISTENTLY per course code in
 * Postgres (MatrizCurricularCacheRepository) — a proper cache-aside: a DB hit
 * (any student, any time after the first-ever scrape of that course) is
 * instant and never touches eCampus again. Only a DB miss falls back to the
 * per-student Redis cache-or-live-scrape path, and the very first successful
 * result (from either source) is written back to the DB cache so every
 * subsequent request — for any student in that course — hits the DB instead.
 */
export class GetMatrizCurricularUseCase {
    private static readonly LIVE_SCRAPE_TIMEOUT_MS = 25000;

    constructor(
        private readonly cache: AcademicDataRepository,
        private readonly scrapingJobService: ScrapingJobService,
        private readonly dbCache: MatrizCurricularCacheRepository
    ) {}

    /** Blocking path (used by the AI/MCP tool): waits out a live scrape if needed. */
    async execute(credentials: AcademicCredentials): Promise<MatrizCurricular | null> {
        const dbHit = await this.tryDbCache(credentials.cpf);
        if (dbHit) return dbHit;

        const redisHit = await this.tryRedisCache(credentials.cpf);
        if (redisHit) return redisHit;

        try {
            const job = await this.scrapingJobService.enqueue('matriz-curricular', { credentials }, {
                dedupeKey: scrapingJobDedupeKey(credentials, 'matriz')
            });
            await job.waitUntilFinished(GetMatrizCurricularUseCase.LIVE_SCRAPE_TIMEOUT_MS);
            const scraped = await this.cache.getMatrizCurricular(credentials.cpf);
            await this.persistToDbCache(scraped);
            return scraped;
        } catch {
            return null;
        }
    }

    /**
     * Cache-or-pending variant for the app: a DB (or Redis) hit returns the
     * matrix instantly; otherwise enqueues the scrape and returns a pending
     * marker (HTTP 202) so the app can poll — instead of blocking the request
     * for the whole scrape like execute() does for the AI/MCP path.
     */
    async requestCachedOrPending(credentials: AcademicCredentials): Promise<MatrizCurricular | PendingScrapeJob> {
        const dbHit = await this.tryDbCache(credentials.cpf);
        if (dbHit) return dbHit;

        const redisHit = await this.tryRedisCache(credentials.cpf);
        if (redisHit) return redisHit;

        await this.scrapingJobService.enqueue('matriz-curricular', { credentials }, {
            dedupeKey: scrapingJobDedupeKey(credentials, 'matriz')
        });
        return pendingScrapeJob('matriz');
    }

    /** DB cache-aside lookup, keyed by the student's own course code (from their cached profile). */
    private async tryDbCache(cpf: string): Promise<MatrizCurricular | null> {
        const codCurso = await this.resolveCourseCode(cpf);
        if (!codCurso) return null;
        return this.dbCache.findByCodCurso(codCurso);
    }

    /** Per-student Redis cache (written by the worker after a scrape). On a hit, backfills the DB cache. */
    private async tryRedisCache(cpf: string): Promise<MatrizCurricular | null> {
        try {
            const matriz = await this.cache.getMatrizCurricular(cpf);
            await this.persistToDbCache(matriz);
            return matriz;
        } catch (error) {
            if (error instanceof AcademicResourceNotFoundException) return null;
            throw error;
        }
    }

    private async resolveCourseCode(cpf: string): Promise<string | null> {
        try {
            const profile = await this.cache.getProfile(cpf);
            return extractCourseCode(profile.academic?.course ?? '');
        } catch {
            return null;
        }
    }

    /** Best-effort — a DB write failure shouldn't fail a request that already has valid data to return. */
    private async persistToDbCache(matriz: MatrizCurricular): Promise<void> {
        const codCurso = extractCourseCode(matriz.curso);
        if (!codCurso) return;
        try {
            await this.dbCache.upsert(codCurso, matriz);
        } catch {
            // ignore — the Redis-backed result is still returned to the caller
        }
    }
}

import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { EcampusAnnouncement } from '@academic/domain/value-objects/ecampus-announcement.value-object';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';
import { pendingScrapeJob, type PendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';
import type { EcampusAnnouncementCacheRepository } from '@academic/infrastructure/prisma/ecampus-announcement-cache.repository';

/**
 * Returns eCampus's institutional announcements. Identical for every
 * student, so — exactly like GetMatrizCurricularUseCase, but with a single
 * global row instead of one per course — it's cached PERSISTENTLY in
 * Postgres: a DB hit (any student, any time after the first-ever scrape) is
 * instant and never touches eCampus again. Only a DB miss falls back to the
 * per-student Redis cache-or-live-scrape path, and the first successful
 * result is written back to the DB so every subsequent request hits it.
 */
export class GetAnnouncementsUseCase {
    private static readonly LIVE_SCRAPE_TIMEOUT_MS = 25000;

    constructor(
        private readonly cache: AcademicDataRepository,
        private readonly scrapingJobService: ScrapingJobService,
        private readonly dbCache: EcampusAnnouncementCacheRepository
    ) {}

    /** Blocking path (used by the AI/MCP tool): waits out a live scrape if needed. */
    async execute(credentials: AcademicCredentials): Promise<EcampusAnnouncement[]> {
        const dbHit = await this.dbCache.find();
        if (dbHit) return dbHit;

        const redisHit = await this.tryRedisCache(credentials.cpf);
        if (redisHit) return redisHit;

        try {
            const job = await this.scrapingJobService.enqueue('announcements', { credentials }, {
                dedupeKey: scrapingJobDedupeKey(credentials, 'announcements')
            });
            await job.waitUntilFinished(GetAnnouncementsUseCase.LIVE_SCRAPE_TIMEOUT_MS);
            const scraped = await this.cache.getAnnouncements(credentials.cpf);
            await this.persistToDbCache(scraped);
            return scraped;
        } catch {
            return [];
        }
    }

    /**
     * Cache-or-pending variant for the app: a DB (or Redis) hit returns the
     * announcements instantly; otherwise enqueues the scrape and returns a
     * pending marker (HTTP 202) so the app can poll.
     */
    async requestCachedOrPending(credentials: AcademicCredentials): Promise<EcampusAnnouncement[] | PendingScrapeJob> {
        const dbHit = await this.dbCache.find();
        if (dbHit) return dbHit;

        const redisHit = await this.tryRedisCache(credentials.cpf);
        if (redisHit) return redisHit;

        await this.scrapingJobService.enqueue('announcements', { credentials }, {
            dedupeKey: scrapingJobDedupeKey(credentials, 'announcements')
        });
        return pendingScrapeJob('announcements');
    }

    /** Per-student Redis cache (written by the worker after a scrape). On a hit, backfills the DB cache. */
    private async tryRedisCache(cpf: string): Promise<EcampusAnnouncement[] | null> {
        try {
            const announcements = await this.cache.getAnnouncements(cpf);
            await this.persistToDbCache(announcements);
            return announcements;
        } catch (error) {
            if (error instanceof AcademicResourceNotFoundException) return null;
            throw error;
        }
    }

    /** Best-effort — a DB write failure shouldn't fail a request that already has valid data to return. */
    private async persistToDbCache(announcements: EcampusAnnouncement[]): Promise<void> {
        try {
            await this.dbCache.upsert(announcements);
        } catch {
            // ignore — the Redis-backed result is still returned to the caller
        }
    }
}

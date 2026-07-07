import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';

export interface ResolvedGradesPeriod {
    /** Omitted when eCampus's current period hasn't been discovered for this student yet. */
    year?: string;
    period?: string;
    /**
     * True when the caller should enqueue a scrape rather than trust cached
     * data — either because the known period's grades aren't cached yet, or
     * because the period itself isn't known yet.
     */
    needsScrape: boolean;
}

/**
 * "Current period" isn't guessed here — the worker already asked eCampus
 * itself (its session pre-selects the student's real current year/period on
 * the grades form) and cached the answer via `saveCurrentPeriod`. This just
 * reads that hint and checks whether grades for it are already cached.
 */
export async function resolveCurrentGradesPeriod(
    cache: AcademicDataRepository,
    cpf: string
): Promise<ResolvedGradesPeriod> {
    const hint = await cache.getCurrentPeriodHint(cpf);
    if (!hint) {
        // Never discovered yet — nothing to key a cache lookup on. The
        // caller enqueues a scrape without year/period so the worker
        // resolves and caches the real period itself.
        return { needsScrape: true };
    }

    try {
        await cache.getGrades(cpf, hint.year, hint.period);
        return { year: hint.year, period: hint.period, needsScrape: false };
    } catch (error) {
        if (error instanceof AcademicResourceNotFoundException) {
            return { year: hint.year, period: hint.period, needsScrape: true };
        }
        throw error;
    }
}

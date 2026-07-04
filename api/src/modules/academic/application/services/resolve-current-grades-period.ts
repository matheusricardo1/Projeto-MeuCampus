import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import { AcademicPeriod } from '@academic/domain/value-objects/academic-period.value-object';

export interface ResolvedGradesPeriod {
    year: string;
    period: string;
    /**
     * True when this candidate hasn't been confirmed by real cached data —
     * the caller should enqueue a scrape for it and return "pending" rather
     * than trust an as-yet-unverified period.
     */
    needsScrape: boolean;
}

/**
 * `AcademicPeriod.guessCurrent()` is a calendar guess and nothing more — it
 * doesn't know the student's actual enrollment. Brazilian federal university
 * terms routinely run behind the calendar (strikes, delays) and essentially
 * never ahead, so when the guessed period's grades come back scraped-but-
 * empty, this checks one real signal before accepting that at face value:
 * lesson-plan-subjects is period-agnostic and always reflects whatever the
 * portal itself currently considers the student's active enrollment. If
 * that's non-empty (student really is enrolled in something right now) but
 * the guessed period has no grades, the previous term is checked — and only
 * trusted if it's actually confirmed (cached and non-empty), or flagged for
 * a scrape if it's never been fetched.
 */
export async function resolveCurrentGradesPeriod(
    cache: AcademicDataRepository,
    cpf: string
): Promise<ResolvedGradesPeriod> {
    const guess = AcademicPeriod.guessCurrent();

    let guessedGrades;
    try {
        guessedGrades = await cache.getGrades(cpf, guess.year, guess.period);
    } catch (error) {
        if (error instanceof AcademicResourceNotFoundException) {
            // Not scraped yet at all — nothing to correct against, let the
            // normal flow enqueue the guess like it always has.
            return { ...toPlain(guess), needsScrape: true };
        }
        throw error;
    }

    if (guessedGrades.length > 0) {
        return { ...toPlain(guess), needsScrape: false };
    }

    const hasActiveEnrollment = await hasNonEmptyLessonPlanSubjects(cache, cpf);
    if (!hasActiveEnrollment) {
        return { ...toPlain(guess), needsScrape: false };
    }

    const previous = guess.previous();
    try {
        const previousGrades = await cache.getGrades(cpf, previous.year, previous.period);
        return previousGrades.length > 0
            ? { ...toPlain(previous), needsScrape: false }
            : { ...toPlain(guess), needsScrape: false };
    } catch (error) {
        if (error instanceof AcademicResourceNotFoundException) {
            // Never scraped — this is the real fix: ask for the previous
            // term specifically, instead of re-confirming the same guess
            // that's already known to be empty.
            return { ...toPlain(previous), needsScrape: true };
        }
        throw error;
    }
}

async function hasNonEmptyLessonPlanSubjects(cache: AcademicDataRepository, cpf: string): Promise<boolean> {
    try {
        const subjects = await cache.getLessonPlanSubjects(cpf);
        return subjects.length > 0;
    } catch {
        return false;
    }
}

function toPlain(period: AcademicPeriod): { year: string; period: string } {
    return { year: period.year, period: period.period };
}

import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { Grade } from '@academic/domain/entities/grade.entity';
import type { CurrentAcademicPeriod } from '@academic/domain/repositories/academic-data.repository';
import { AcademicPeriod } from '@academic/domain/value-objects/academic-period.value-object';
import { subjectNameLooselyMatches } from '@academic/domain/services/academic-subject-identity';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';

export interface FindGradesAcrossPreviousPeriodsInput {
    credentials: AcademicCredentials;
    subjectQuery: string;
    /** Continue searching strictly before this period - set when the student says the match found isn't the one they meant. */
    beforeYear?: string;
    beforePeriod?: string;
}

export type FindGradesAcrossPreviousPeriodsResult =
    | { found: true; year: string; period: string; matches: Grade[]; periodsChecked: CurrentAcademicPeriod[] }
    | { found: false; periodsChecked: CurrentAcademicPeriod[]; searchedBackToYear: string };

/**
 * Walks backwards, two terms at a time, from the student's current (or a
 * given "before") period down to their admission year, looking for a
 * subject whose name loosely matches `subjectQuery`. Checks cache first
 * (instant) and only falls back to a live eCampus scrape on a cache miss -
 * capped, since a live scrape is a real multi-second worker round trip and
 * this can be called mid-chat-response. Periods within a batch are fetched
 * concurrently, but the earliest (most recent) match in the batch still wins
 * so results stay in the same order as a strictly sequential walk would give.
 */
export class FindGradesAcrossPreviousPeriodsUseCase {
    private static readonly MAX_LIVE_SCRAPES = 4;
    private static readonly LIVE_SCRAPE_TIMEOUT_MS = 12000;
    private static readonly DEFAULT_LOOKBACK_YEARS = 6;
    private static readonly PERIOD_BATCH_SIZE = 2;

    constructor(
        private readonly cache: AcademicDataRepository,
        private readonly scrapingJobService: ScrapingJobService
    ) {}

    async execute(input: FindGradesAcrossPreviousPeriodsInput): Promise<FindGradesAcrossPreviousPeriodsResult> {
        const cpf = input.credentials.cpf;
        const admissionYear = await this.resolveAdmissionYear(cpf);

        const startFrom = input.beforeYear && input.beforePeriod
            ? AcademicPeriod.create(input.beforeYear, input.beforePeriod)
            : await this.resolveCurrentPeriod(cpf);

        let cursor = startFrom.previous();
        const periodsChecked: CurrentAcademicPeriod[] = [];
        let liveScrapesRemaining = FindGradesAcrossPreviousPeriodsUseCase.MAX_LIVE_SCRAPES;

        while (Number(cursor.year) >= admissionYear) {
            const batch: AcademicPeriod[] = [];
            let batchCursor = cursor;
            while (batch.length < FindGradesAcrossPreviousPeriodsUseCase.PERIOD_BATCH_SIZE && Number(batchCursor.year) >= admissionYear) {
                batch.push(batchCursor);
                batchCursor = batchCursor.previous();
            }

            const results = await Promise.all(
                batch.map(async (period, index) => {
                    // Worst-case budget check: assumes every earlier item in the
                    // batch also live-scrapes, so the batch never overspends
                    // liveScrapesRemaining even though items run concurrently.
                    const canLiveScrape = liveScrapesRemaining - index > 0;
                    const result = await this.fetchPeriodGrades(input.credentials, period, canLiveScrape);
                    return { period, ...result };
                })
            );

            liveScrapesRemaining -= results.filter((result) => result.wasLiveScraped).length;

            for (const result of results) {
                periodsChecked.push({ year: result.period.year, period: result.period.period });

                const matches = result.grades?.filter((grade) => subjectNameLooselyMatches(grade.subject, input.subjectQuery)) ?? [];
                if (matches.length > 0) {
                    return { found: true, year: result.period.year, period: result.period.period, matches, periodsChecked };
                }
            }

            cursor = batchCursor;
        }

        return { found: false, periodsChecked, searchedBackToYear: String(admissionYear) };
    }

    private async fetchPeriodGrades(
        credentials: AcademicCredentials,
        period: AcademicPeriod,
        canLiveScrape: boolean
    ): Promise<{ grades: Grade[] | null; wasLiveScraped: boolean }> {
        try {
            const grades = await this.cache.getGrades(credentials.cpf, period.year, period.period);
            return { grades, wasLiveScraped: false };
        } catch (error) {
            if (!(error instanceof AcademicResourceNotFoundException) || !canLiveScrape) {
                return { grades: null, wasLiveScraped: false };
            }
        }

        try {
            const job = await this.scrapingJobService.enqueue('grades', {
                credentials,
                year: period.year,
                period: period.period
            }, {
                dedupeKey: scrapingJobDedupeKey(credentials, 'grades', period.cacheSuffix())
            });
            await job.waitUntilFinished(FindGradesAcrossPreviousPeriodsUseCase.LIVE_SCRAPE_TIMEOUT_MS);
            const grades = await this.cache.getGrades(credentials.cpf, period.year, period.period);
            return { grades, wasLiveScraped: true };
        } catch {
            return { grades: null, wasLiveScraped: true };
        }
    }

    private async resolveCurrentPeriod(cpf: string): Promise<AcademicPeriod> {
        const hint = await this.cache.getCurrentPeriodHint(cpf) ?? AcademicPeriod.guessCurrent();
        return AcademicPeriod.create(hint.year, hint.period);
    }

    private async resolveAdmissionYear(cpf: string): Promise<number> {
        const fallback = new Date().getFullYear() - FindGradesAcrossPreviousPeriodsUseCase.DEFAULT_LOOKBACK_YEARS;

        try {
            const profile = await this.cache.getProfile(cpf);
            const match = profile.academic.admission_term?.match(/\b(19|20)\d{2}\b/);
            const parsed = match ? Number(match[0]) : NaN;
            return Number.isFinite(parsed) ? parsed : fallback;
        } catch {
            return fallback;
        }
    }
}

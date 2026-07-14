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
 * Walks backwards, one term at a time, from the student's current (or a
 * given "before") period down to their admission year, looking for a
 * subject whose name loosely matches `subjectQuery`. Checks cache first
 * (instant) and only falls back to a live eCampus scrape on a cache miss -
 * capped, since a live scrape is a real multi-second worker round trip and
 * this can be called mid-chat-response.
 */
export class FindGradesAcrossPreviousPeriodsUseCase {
    private static readonly MAX_LIVE_SCRAPES = 4;
    private static readonly LIVE_SCRAPE_TIMEOUT_MS = 12000;
    private static readonly DEFAULT_LOOKBACK_YEARS = 6;

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
            periodsChecked.push({ year: cursor.year, period: cursor.period });

            const canLiveScrape = liveScrapesRemaining > 0;
            const { grades, wasLiveScraped } = await this.fetchPeriodGrades(input.credentials, cursor, canLiveScrape);
            if (wasLiveScraped) {
                liveScrapesRemaining -= 1;
            }

            const matches = grades?.filter((grade) => subjectNameLooselyMatches(grade.subject, input.subjectQuery)) ?? [];
            if (matches.length > 0) {
                return { found: true, year: cursor.year, period: cursor.period, matches, periodsChecked };
            }

            cursor = cursor.previous();
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

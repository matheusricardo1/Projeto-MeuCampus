import { InvalidAcademicPeriodException, InvalidAcademicYearException } from '@academic/domain/exceptions/invalid-academic-period.exception';

/**
 * Every valid eCampus period code, including the raw numeric codes the
 * portal itself uses (201/202/203/204/401) and the human aliases we accept
 * on the way in. This is the one place that knows this list — nothing else
 * in the API should hardcode it.
 */
const ACCEPTED_PERIODS = new Set(['1', '1o', '201', '2', '2o', '202', 'ferias1', 'ferias-1', '203', 'ferias2', 'ferias-2', '204', 'especial', '5', '401']);

/**
 * A UFAM/eCampus academic period: a year paired with a period code. Owns
 * every rule the rest of the API needs about periods — what counts as valid,
 * today's best calendar guess, and how to step to the previous one — so
 * those rules live in exactly one place instead of being re-derived wherever
 * they're needed.
 */
export class AcademicPeriod {
    private constructor(
        public readonly year: string,
        public readonly period: string
    ) {}

    static create(year: string, period: string): AcademicPeriod {
        return new AcademicPeriod(
            AcademicPeriod.validateYear(year),
            AcademicPeriod.validatePeriod(period)
        );
    }

    /**
     * A calendar-based default — nothing more. It assumes a "clean" academic
     * calendar (period 1 = Jan-Jun, period 2 = Jul-Dec) and knows nothing
     * about the student's actual enrollment. Federal university terms in
     * Brazil routinely run behind this due to strikes/delays, so treat this
     * as a starting guess to validate against real data, never as truth.
     */
    static guessCurrent(now = new Date()): AcademicPeriod {
        return new AcademicPeriod(now.getFullYear().toString(), now.getMonth() >= 6 ? '2' : '1');
    }

    static validateYear(value: string): string {
        const normalizedYear = value.trim();
        if (!/^\d{4}$/.test(normalizedYear)) {
            throw new InvalidAcademicYearException('Informe um ano com 4 digitos.');
        }

        const numericYear = Number(normalizedYear);
        const nextYear = new Date().getFullYear() + 1;
        if (numericYear < 2000 || numericYear > nextYear) {
            throw new InvalidAcademicYearException();
        }

        return normalizedYear;
    }

    static validatePeriod(value: string): string {
        const normalizedPeriod = value.trim().toLowerCase();
        if (!ACCEPTED_PERIODS.has(normalizedPeriod)) {
            throw new InvalidAcademicPeriodException();
        }

        return normalizedPeriod;
    }

    /**
     * Steps back one term (2 -> 1 same year, 1 -> 2 previous year). Only
     * meaningful for the simple '1'/'2' codes `guessCurrent` produces —
     * not a general predecessor for exotic codes like "ferias1"/"especial".
     */
    previous(): AcademicPeriod {
        return this.period === '1'
            ? new AcademicPeriod(String(Number(this.year) - 1), '2')
            : new AcademicPeriod(this.year, '1');
    }

    cacheSuffix(): string {
        return `${this.year}-${this.period}`;
    }
}

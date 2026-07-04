/**
 * A UFAM/eCampus academic period: a year paired with a period code ('1'/'2').
 * Owns the one rule this app needs about periods — today's best calendar
 * guess — so it lives in exactly one place instead of being re-derived
 * wherever a default year/period is needed.
 */
export class AcademicPeriod {
    private constructor(
        public readonly year: string,
        public readonly period: string
    ) {}

    /**
     * A calendar-based default — nothing more. Federal university terms in
     * Brazil routinely run behind this (strikes, delays), so treat this as
     * a starting guess, never as truth; the API resolves the real current
     * period from actual data.
     */
    static guessCurrent(now = new Date()): AcademicPeriod {
        return new AcademicPeriod(now.getFullYear().toString(), now.getMonth() >= 6 ? '2' : '1');
    }

    matches(year: string, period: string): boolean {
        return this.year === year && this.period === period;
    }
}

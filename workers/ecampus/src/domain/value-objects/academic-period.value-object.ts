/**
 * Every accepted period alias mapped to eCampus's own raw numeric period
 * code. The one place this worker knows eCampus's period wire format —
 * nothing else in this codebase should hardcode it.
 */
const ECAMPUS_PERIOD_CODES: Record<string, string> = {
    '1': '201', '1o': '201', '201': '201',
    '2': '202', '2o': '202', '202': '202',
    'ferias1': '203', 'ferias-1': '203', '203': '203',
    'ferias2': '204', 'ferias-2': '204', '204': '204',
    'especial': '401', '5': '401', '401': '401'
};

/**
 * A UFAM/eCampus academic period. Owns the two period rules this worker
 * actually needs: today's best calendar guess, and eCampus's own raw wire
 * code for a period.
 */
export class AcademicPeriod {
    private constructor(
        public readonly year: string,
        public readonly period: string
    ) {}

    /**
     * A calendar-based default — nothing more. Federal university terms in
     * Brazil routinely run behind this (strikes, delays), so treat this as
     * a starting guess, never as truth.
     */
    static guessCurrent(now = new Date()): AcademicPeriod {
        return new AcademicPeriod(now.getFullYear().toString(), now.getMonth() >= 6 ? '2' : '1');
    }

    /** eCampus's own raw numeric period code (201/202/203/204/401) for any accepted period alias. Falls back to the input unchanged if it's already a raw code eCampus doesn't recognize under a known alias. */
    static toEcampusCode(period: string): string {
        return ECAMPUS_PERIOD_CODES[period.trim().toLowerCase()] || period;
    }

    /**
     * The reverse of `toEcampusCode`, collapsed onto the two periods this app
     * models ('1'/'2'). eCampus's intersession codes (férias, especial) have
     * no equivalent here, so they fall back to the nearer regular semester
     * rather than surfacing a period the rest of the app doesn't understand.
     */
    static fromEcampusCode(code: string): string {
        const trimmed = code.trim();
        if (trimmed === '201' || trimmed === '203') return '1';
        if (trimmed === '202' || trimmed === '204') return '2';
        return AcademicPeriod.guessCurrent().period;
    }
}

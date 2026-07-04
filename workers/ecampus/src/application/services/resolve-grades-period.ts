import { AcademicPeriod } from '@/domain/value-objects/academic-period.value-object';

export function resolveGradesPeriod(data: Record<string, unknown>): { year: string; period: string } {
    const fallback = AcademicPeriod.guessCurrent();
    const year = typeof data.year === 'string' && data.year.trim()
        ? data.year.trim()
        : fallback.year;
    const period = typeof data.period === 'string' && data.period.trim()
        ? data.period.trim()
        : fallback.period;

    return { year, period };
}

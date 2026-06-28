import { InvalidAcademicPeriodException, InvalidAcademicYearException } from '@academic/domain/exceptions/invalid-academic-period.exception';

const acceptedPeriods = new Set(['1', '1o', '201', '2', '2o', '202', 'ferias1', 'ferias-1', '203', 'ferias2', 'ferias-2', '204', 'especial', '5', '401']);

export class AcademicPeriod {
    private constructor(
        public readonly year: string,
        public readonly period: string
    ) {}

    static create(year: string, period: string): AcademicPeriod {
        const normalizedYear = year.trim();
        const normalizedPeriod = period.trim().toLowerCase();

        if (!/^\d{4}$/.test(normalizedYear)) {
            throw new InvalidAcademicYearException('Informe um ano com 4 digitos.');
        }

        const numericYear = Number(normalizedYear);
        const nextYear = new Date().getFullYear() + 1;
        if (numericYear < 2000 || numericYear > nextYear) {
            throw new InvalidAcademicYearException();
        }

        if (!acceptedPeriods.has(normalizedPeriod)) {
            throw new InvalidAcademicPeriodException();
        }

        return new AcademicPeriod(normalizedYear, normalizedPeriod);
    }

    cacheSuffix(): string {
        return `${this.year}-${this.period}`;
    }
}

import { describe, expect, it } from 'vitest';
import { AcademicPeriod } from '@academic/domain/value-objects/academic-period.value-object';
import { InvalidAcademicPeriodException, InvalidAcademicYearException } from '@academic/domain/exceptions/invalid-academic-period.exception';

describe('AcademicPeriod.create', () => {
    it('creates a period from a valid year and period code', () => {
        const period = AcademicPeriod.create('2024', '1');
        expect(period.year).toBe('2024');
        expect(period.period).toBe('1');
    });

    it('trims the year and lowercases/trims the period', () => {
        const period = AcademicPeriod.create(' 2024 ', ' FERIAS1 ');
        expect(period.year).toBe('2024');
        expect(period.period).toBe('ferias1');
    });

    it.each(['201', '2', '2o', '202', 'ferias1', 'ferias-1', '203', 'ferias2', 'ferias-2', '204', 'especial', '5', '401', '1o'])(
        'accepts the period code "%s"',
        (code) => {
            expect(() => AcademicPeriod.create('2024', code)).not.toThrow();
        }
    );

    it('rejects an unknown period code', () => {
        expect(() => AcademicPeriod.create('2024', 'summer')).toThrow(InvalidAcademicPeriodException);
    });

    it('rejects a year that is not exactly 4 digits', () => {
        expect(() => AcademicPeriod.create('24', '1')).toThrow(InvalidAcademicYearException);
        expect(() => AcademicPeriod.create('20244', '1')).toThrow(InvalidAcademicYearException);
        expect(() => AcademicPeriod.create('abcd', '1')).toThrow(InvalidAcademicYearException);
    });

    it('rejects a year before 2000', () => {
        expect(() => AcademicPeriod.create('1999', '1')).toThrow(InvalidAcademicYearException);
    });

    it('rejects a year more than one year in the future', () => {
        const tooFar = (new Date().getFullYear() + 2).toString();
        expect(() => AcademicPeriod.create(tooFar, '1')).toThrow(InvalidAcademicYearException);
    });

    it('accepts next year (a common boundary for enrollment planning)', () => {
        const nextYear = (new Date().getFullYear() + 1).toString();
        expect(() => AcademicPeriod.create(nextYear, '1')).not.toThrow();
    });
});

describe('AcademicPeriod.guessCurrent', () => {
    it('guesses period 1 for a date before July', () => {
        const period = AcademicPeriod.guessCurrent(new Date(2024, 2, 15));
        expect(period.year).toBe('2024');
        expect(period.period).toBe('1');
    });

    it('guesses period 2 for a date from July onward', () => {
        const period = AcademicPeriod.guessCurrent(new Date(2024, 6, 1));
        expect(period.year).toBe('2024');
        expect(period.period).toBe('2');
    });

    it('guesses period 1 for the last day of June', () => {
        const period = AcademicPeriod.guessCurrent(new Date(2024, 5, 30));
        expect(period.period).toBe('1');
    });
});

describe('AcademicPeriod.previous', () => {
    it('steps from period 2 to period 1 in the same year', () => {
        const period = AcademicPeriod.create('2024', '2').previous();
        expect(period.year).toBe('2024');
        expect(period.period).toBe('1');
    });

    it('steps from period 1 to period 2 in the previous year', () => {
        const period = AcademicPeriod.create('2024', '1').previous();
        expect(period.year).toBe('2023');
        expect(period.period).toBe('2');
    });
});

describe('AcademicPeriod.cacheSuffix', () => {
    it('joins year and period with a dash', () => {
        expect(AcademicPeriod.create('2024', '2').cacheSuffix()).toBe('2024-2');
    });
});

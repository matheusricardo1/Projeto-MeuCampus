import { describe, expect, it } from 'vitest';
import { GetGradesQuery } from '@academic/presentation/http/dto/get-grades.query';

describe('GetGradesQuery', () => {
    it('parses a valid year and period', () => {
        const query = new GetGradesQuery('2024', '1');
        expect(query.toUseCaseInput()).toEqual({ year: '2024', period: '1' });
    });

    it('returns undefined fields when year/period are omitted', () => {
        const query = new GetGradesQuery(undefined, undefined);
        expect(query.toUseCaseInput()).toEqual({ year: undefined, period: undefined });
    });

    it('throws when the year is invalid', () => {
        const query = new GetGradesQuery('not-a-year', '1');
        expect(() => query.toUseCaseInput()).toThrow();
    });

    it('throws when the period is invalid', () => {
        const query = new GetGradesQuery('2024', 'not-a-period');
        expect(() => query.toUseCaseInput()).toThrow();
    });
});

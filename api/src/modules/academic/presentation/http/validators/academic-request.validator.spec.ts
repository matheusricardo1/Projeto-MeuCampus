import { describe, expect, it } from 'vitest';
import { AcademicRequestValidator } from '@academic/presentation/http/validators/academic-request.validator';
import { InvalidAcademicRequestError } from '@academic/presentation/http/errors/invalid-academic-request.error';

describe('AcademicRequestValidator.parseCpf', () => {
    it('accepts a valid CPF with correct check digits', () => {
        expect(AcademicRequestValidator.parseCpf('529.982.247-25')).toBe('52998224725');
    });

    it('strips non-digit formatting characters', () => {
        expect(AcademicRequestValidator.parseCpf('111.444.777-35')).toBe('11144477735');
    });

    it('rejects a CPF with an invalid check digit', () => {
        expect(() => AcademicRequestValidator.parseCpf('52998224726')).toThrow(InvalidAcademicRequestError);
    });

    it('rejects a CPF with all repeated digits (a common fake-CPF pattern)', () => {
        expect(() => AcademicRequestValidator.parseCpf('11111111111')).toThrow(InvalidAcademicRequestError);
    });

    it('rejects a CPF with the wrong number of digits', () => {
        expect(() => AcademicRequestValidator.parseCpf('123456789')).toThrow(InvalidAcademicRequestError);
    });

    it('rejects undefined/empty input', () => {
        expect(() => AcademicRequestValidator.parseCpf(undefined)).toThrow(InvalidAcademicRequestError);
        expect(() => AcademicRequestValidator.parseCpf('')).toThrow(InvalidAcademicRequestError);
    });
});

describe('AcademicRequestValidator.parsePassword', () => {
    it('accepts a normal password', () => {
        expect(AcademicRequestValidator.parsePassword('secret123')).toBe('secret123');
    });

    it('accepts a single-character password (eCampus enforces no minimum)', () => {
        expect(AcademicRequestValidator.parsePassword('a')).toBe('a');
    });

    it('accepts a password containing a plain space (not a control character)', () => {
        expect(AcademicRequestValidator.parsePassword('two words')).toBe('two words');
    });

    it('accepts a 100-character password (the upper bound)', () => {
        const password = 'a'.repeat(100);
        expect(AcademicRequestValidator.parsePassword(password)).toBe(password);
    });

    it('rejects a password longer than 100 characters', () => {
        expect(() => AcademicRequestValidator.parsePassword('a'.repeat(101))).toThrow(InvalidAcademicRequestError);
    });

    it('rejects an empty password', () => {
        expect(() => AcademicRequestValidator.parsePassword('')).toThrow(InvalidAcademicRequestError);
    });

    it('rejects a non-string value', () => {
        expect(() => AcademicRequestValidator.parsePassword(undefined)).toThrow(InvalidAcademicRequestError);
    });

    it('rejects a password containing control characters', () => {
        expect(() => AcademicRequestValidator.parsePassword('secretX'.replace('X', String.fromCharCode(10)))).toThrow(InvalidAcademicRequestError);
        expect(() => AcademicRequestValidator.parsePassword('secretX'.replace('X', String.fromCharCode(9)))).toThrow(InvalidAcademicRequestError);
    });
});

describe('AcademicRequestValidator.parseYear', () => {
    it('returns undefined when no year is given', () => {
        expect(AcademicRequestValidator.parseYear(undefined)).toBeUndefined();
        expect(AcademicRequestValidator.parseYear('')).toBeUndefined();
    });

    it('validates and returns a trimmed year', () => {
        expect(AcademicRequestValidator.parseYear(' 2024 ')).toBe('2024');
    });

    it('throws for an invalid year', () => {
        expect(() => AcademicRequestValidator.parseYear('abcd')).toThrow();
    });
});

describe('AcademicRequestValidator.parsePeriod', () => {
    it('returns undefined when no period is given', () => {
        expect(AcademicRequestValidator.parsePeriod(undefined)).toBeUndefined();
        expect(AcademicRequestValidator.parsePeriod('')).toBeUndefined();
    });

    it('validates and returns a normalized period', () => {
        expect(AcademicRequestValidator.parsePeriod(' 2 ')).toBe('2');
    });

    it('throws for an invalid period', () => {
        expect(() => AcademicRequestValidator.parsePeriod('summer')).toThrow();
    });
});

describe('AcademicRequestValidator.parsePlanId', () => {
    it('accepts a numeric plan id', () => {
        expect(AcademicRequestValidator.parsePlanId('12345')).toBe('12345');
    });

    it('trims surrounding whitespace', () => {
        expect(AcademicRequestValidator.parsePlanId('  12345  ')).toBe('12345');
    });

    it('rejects a non-numeric plan id', () => {
        expect(() => AcademicRequestValidator.parsePlanId('abc123')).toThrow(InvalidAcademicRequestError);
    });

    it('rejects an empty plan id', () => {
        expect(() => AcademicRequestValidator.parsePlanId('')).toThrow(InvalidAcademicRequestError);
    });

    it('rejects a plan id longer than 20 digits', () => {
        expect(() => AcademicRequestValidator.parsePlanId('1'.repeat(21))).toThrow(InvalidAcademicRequestError);
    });
});

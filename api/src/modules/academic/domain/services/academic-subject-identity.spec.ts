import { describe, expect, it } from 'vitest';
import { isSameSubject, normalizeSubjectText, subjectIdentityKey } from '@academic/domain/services/academic-subject-identity';

describe('normalizeSubjectText', () => {
    it('trims and lowercases', () => {
        expect(normalizeSubjectText('  Calculo I  ')).toBe('calculo i');
    });

    it('strips diacritics', () => {
        expect(normalizeSubjectText('Cálculo Numérico')).toBe('calculo numerico');
    });
});

describe('subjectIdentityKey', () => {
    it('prefers code when present', () => {
        expect(subjectIdentityKey('MAT101', 'T01', 'Calculo I')).toBe('mat101');
    });

    it('falls back to classIdentifier when code is empty', () => {
        expect(subjectIdentityKey('', 'T01', 'Calculo I')).toBe('t01');
    });

    it('falls back to normalized subject name when both code and classIdentifier are empty', () => {
        expect(subjectIdentityKey('', '', 'Cálculo I')).toBe('calculo i');
    });

    it('normalizes whichever field it uses', () => {
        expect(subjectIdentityKey('  MAT101  ', '', '')).toBe('mat101');
    });
});

describe('isSameSubject', () => {
    const item = { code: 'MAT101', classIdentifier: 'T01', subject: 'Calculo I' };

    it('matches on code', () => {
        expect(isSameSubject(item, 'MAT101', '', '')).toBe(true);
    });

    it('matches on classIdentifier when code differs', () => {
        expect(isSameSubject(item, 'OTHER', 'T01', '')).toBe(true);
    });

    it('matches on normalized subject name when code and classIdentifier differ', () => {
        expect(isSameSubject(item, 'OTHER', 'T02', 'Cálculo I')).toBe(true);
    });

    it('reads class_identifier (snake_case) as a fallback for classIdentifier', () => {
        const snakeCaseItem = { code: 'MAT101', class_identifier: 'T01', subject: 'Calculo I' };
        expect(isSameSubject(snakeCaseItem, 'OTHER', 'T01', '')).toBe(true);
    });

    it('does not match when nothing lines up', () => {
        expect(isSameSubject(item, 'OTHER', 'T99', 'Fisica II')).toBe(false);
    });

    it('does not match on empty-string fields (falsy guards prevent empty-vs-empty false positives)', () => {
        const emptyItem = { code: '', classIdentifier: '', subject: '' };
        expect(isSameSubject(emptyItem, '', '', '')).toBe(false);
    });
});

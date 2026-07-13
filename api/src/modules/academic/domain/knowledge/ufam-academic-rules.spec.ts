import { describe, expect, it } from 'vitest';
import { UFAM_ACADEMIC_RULES } from '@academic/domain/knowledge/ufam-academic-rules';

describe('UFAM_ACADEMIC_RULES', () => {
    it('is a non-empty, trimmed string', () => {
        expect(typeof UFAM_ACADEMIC_RULES).toBe('string');
        expect(UFAM_ACADEMIC_RULES.length).toBeGreaterThan(0);
        expect(UFAM_ACADEMIC_RULES).toBe(UFAM_ACADEMIC_RULES.trim());
    });

    it('documents the final grade (MF) formula', () => {
        expect(UFAM_ACADEMIC_RULES).toContain('MF = (2 x MEE + PF) / 3');
    });

    it('documents the approval thresholds (MF >= 5.0, frequency >= 75%)', () => {
        expect(UFAM_ACADEMIC_RULES).toContain('MF >= 5,0');
        expect(UFAM_ACADEMIC_RULES).toContain('75%');
    });

    it('documents the maximum allowed absence percentage', () => {
        expect(UFAM_ACADEMIC_RULES).toContain('25%');
    });
});

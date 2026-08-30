import { describe, expect, it } from 'vitest';
import { formatCpf } from '@/infrastructure/ru-digital-portal/format-cpf';

describe('formatCpf', () => {
    it('formats a raw 11-digit CPF into RU Digital\'s masked format', () => {
        expect(formatCpf('06124555212')).toBe('061.245.552-12');
    });

    it('strips any existing mask/punctuation before reformatting', () => {
        expect(formatCpf('061.245.552-12')).toBe('061.245.552-12');
    });

    it('pads a CPF missing a leading zero to 11 digits', () => {
        expect(formatCpf('6124555212')).toBe('061.245.552-12');
    });

    it('ignores non-digit characters mixed into the input', () => {
        expect(formatCpf('061 245 552 12')).toBe('061.245.552-12');
    });
});

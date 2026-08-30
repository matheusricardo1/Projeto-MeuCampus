import { describe, expect, it } from 'vitest';
import { scrapingJobDedupeKey } from '@ru-digital/application/services/scraping-job-dedupe-key';

describe('scrapingJobDedupeKey', () => {
    it('joins the cpf and resource with the ru-digital prefix', () => {
        expect(scrapingJobDedupeKey({ cpf: '06124555212' }, 'balance')).toBe('ru-digital-06124555212-balance');
    });

    it('appends an optional suffix (e.g. a date or restaurant id)', () => {
        expect(scrapingJobDedupeKey({ cpf: '06124555212' }, 'daily-menu', '2026-08-28')).toBe('ru-digital-06124555212-daily-menu-2026-08-28');
    });

    it('omits the suffix segment entirely when not provided', () => {
        expect(scrapingJobDedupeKey({ cpf: '06124555212' }, 'restaurant-list', undefined)).toBe('ru-digital-06124555212-restaurant-list');
    });

    it('produces different keys for different students requesting the same resource', () => {
        const a = scrapingJobDedupeKey({ cpf: '11111111111' }, 'balance');
        const b = scrapingJobDedupeKey({ cpf: '22222222222' }, 'balance');
        expect(a).not.toBe(b);
    });
});

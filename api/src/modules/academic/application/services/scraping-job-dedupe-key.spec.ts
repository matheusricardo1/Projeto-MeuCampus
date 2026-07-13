import { describe, expect, it } from 'vitest';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';

describe('scrapingJobDedupeKey', () => {
    it('joins cpf, resource and suffix with dashes', () => {
        expect(scrapingJobDedupeKey({ cpf: '12345678900' }, 'grades', '2024-1')).toBe('12345678900-grades-2024-1');
    });

    it('omits the suffix when not provided', () => {
        expect(scrapingJobDedupeKey({ cpf: '12345678900' }, 'profile')).toBe('12345678900-profile');
    });

    it('omits an empty-string suffix (falsy filter)', () => {
        expect(scrapingJobDedupeKey({ cpf: '12345678900' }, 'profile', '')).toBe('12345678900-profile');
    });
});

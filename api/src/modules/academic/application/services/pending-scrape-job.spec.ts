import { describe, expect, it } from 'vitest';
import { isPendingScrapeJob, pendingScrapeJob } from '@academic/application/services/pending-scrape-job';

describe('pendingScrapeJob', () => {
    it('builds a pending job descriptor for the given resource', () => {
        expect(pendingScrapeJob('grades')).toEqual({ status: 'pending', resource: 'grades' });
    });
});

describe('isPendingScrapeJob', () => {
    it('recognizes a value built by pendingScrapeJob', () => {
        expect(isPendingScrapeJob(pendingScrapeJob('profile'))).toBe(true);
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a string', 'pending'],
        ['a number', 42],
        ['an object with the wrong status', { status: 'ready', resource: 'grades' }],
        ['an object missing resource', { status: 'pending' }],
        ['an object with a non-string resource', { status: 'pending', resource: 42 }],
        ['an array', ['pending', 'grades']]
    ])('rejects %s', (_label, value) => {
        expect(isPendingScrapeJob(value)).toBe(false);
    });

    it('rejects real domain data that merely happens to have a status field', () => {
        expect(isPendingScrapeJob({ status: 'ok' })).toBe(false);
    });
});

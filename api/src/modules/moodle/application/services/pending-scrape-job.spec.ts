import { describe, expect, it } from 'vitest';
import { isPendingScrapeJob, pendingScrapeJob } from '@moodle/application/services/pending-scrape-job';

describe('pendingScrapeJob / isPendingScrapeJob', () => {
    it('builds a pending job marker for a resource', () => {
        expect(pendingScrapeJob('courses')).toEqual({ status: 'pending', resource: 'courses' });
    });

    it('recognizes a value built by pendingScrapeJob', () => {
        expect(isPendingScrapeJob(pendingScrapeJob('timeline'))).toBe(true);
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['a plain array', []],
        ['an object missing status', { resource: 'courses' }],
        ['an object with the wrong status', { status: 'done', resource: 'courses' }],
        ['an object with a non-string resource', { status: 'pending', resource: 42 }]
    ])('rejects %s', (_label, value) => {
        expect(isPendingScrapeJob(value)).toBe(false);
    });
});

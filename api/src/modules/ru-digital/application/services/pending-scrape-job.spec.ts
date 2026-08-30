import { describe, expect, it } from 'vitest';
import { isPendingScrapeJob, pendingScrapeJob } from '@ru-digital/application/services/pending-scrape-job';

describe('pendingScrapeJob', () => {
    it('builds a pending marker for the given resource', () => {
        expect(pendingScrapeJob('balance')).toEqual({ status: 'pending', resource: 'balance' });
    });
});

describe('isPendingScrapeJob', () => {
    it('recognizes a value built by pendingScrapeJob', () => {
        expect(isPendingScrapeJob(pendingScrapeJob('daily-menu'))).toBe(true);
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a string', 'pending'],
        ['a number', 202],
        ['an array', []],
        ['a real resource object', { breakfast: {}, lunch: {}, dinner: {} }],
        ['an object with the wrong status', { status: 'ready', resource: 'balance' }],
        ['an object with a non-string resource', { status: 'pending', resource: 42 }],
        ['an object missing resource entirely', { status: 'pending' }]
    ])('rejects %s', (_label, value) => {
        expect(isPendingScrapeJob(value)).toBe(false);
    });
});

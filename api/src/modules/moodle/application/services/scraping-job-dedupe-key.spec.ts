import { describe, expect, it } from 'vitest';
import { scrapingJobDedupeKey } from '@moodle/application/services/scraping-job-dedupe-key';

const CREDENTIALS = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1' };

describe('scrapingJobDedupeKey', () => {
    it('builds a key from the moodle prefix, identity, and resource', () => {
        expect(scrapingJobDedupeKey(CREDENTIALS, 'moodle-courses')).toBe('moodle-icomp-colab:matheusricardo1-moodle-courses');
    });

    it('appends the suffix when given', () => {
        expect(scrapingJobDedupeKey(CREDENTIALS, 'moodle-timeline', '2026-2')).toBe('moodle-icomp-colab:matheusricardo1-moodle-timeline-2026-2');
    });

    it('differs across instances for the same username and resource', () => {
        const a = scrapingJobDedupeKey({ instanceId: 'icomp-colab', username: 'matheusricardo1' }, 'moodle-courses');
        const b = scrapingJobDedupeKey({ instanceId: 'colabweb', username: 'matheusricardo1' }, 'moodle-courses');
        expect(a).not.toBe(b);
    });
});

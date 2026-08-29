import { describe, expect, it } from 'vitest';
import { moodleIdentity } from '@/application/services/moodle-identity';

describe('moodleIdentity', () => {
    it('joins instanceId and username with a colon', () => {
        expect(moodleIdentity({ instanceId: 'icomp-colab', username: 'matheusricardo1' })).toBe('icomp-colab:matheusricardo1');
    });

    it('keeps the same username distinct across different instances', () => {
        const a = moodleIdentity({ instanceId: 'icomp-colab', username: 'matheusricardo1' });
        const b = moodleIdentity({ instanceId: 'colabweb', username: 'matheusricardo1' });
        expect(a).not.toBe(b);
    });

    it('ignores extra fields on the credentials object (e.g. session)', () => {
        const identity = moodleIdentity({ instanceId: 'colabweb', username: 'matheusricardo1', session: { token: 'x' } } as any);
        expect(identity).toBe('colabweb:matheusricardo1');
    });
});

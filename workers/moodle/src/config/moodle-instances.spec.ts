import { describe, expect, it } from 'vitest';
import { MOODLE_INSTANCES, resolveMoodleInstance } from '@/config/moodle-instances';

describe('resolveMoodleInstance', () => {
    it('resolves a known instance to its config', () => {
        expect(resolveMoodleInstance('icomp-colab')).toEqual(MOODLE_INSTANCES['icomp-colab']);
        expect(resolveMoodleInstance('colabweb')).toEqual(MOODLE_INSTANCES.colabweb);
    });

    it('every registered instance uses HTTPS', () => {
        for (const instance of Object.values(MOODLE_INSTANCES)) {
            expect(new URL(instance.baseUrl).protocol).toBe('https:');
        }
    });

    it('throws for an unknown instance id instead of silently returning undefined', () => {
        // @ts-expect-error deliberately passing an invalid id to exercise the runtime guard
        expect(() => resolveMoodleInstance('not-a-real-instance')).toThrow('Unknown Moodle instance: not-a-real-instance');
    });
});

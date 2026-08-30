import { describe, expect, it } from 'vitest';
import { MOODLE_INSTANCES, isMoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';

describe('isMoodleInstanceId', () => {
    it('accepts every id in the published registry', () => {
        for (const instance of MOODLE_INSTANCES) {
            expect(isMoodleInstanceId(instance.id)).toBe(true);
        }
    });

    it('rejects an unregistered id, including a plausible-looking one', () => {
        expect(isMoodleInstanceId('ufam-virtual')).toBe(false);
        expect(isMoodleInstanceId('')).toBe(false);
        expect(isMoodleInstanceId('ICOMP-COLAB')).toBe(false);
    });
});

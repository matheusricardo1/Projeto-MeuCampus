export type MoodleInstanceId = 'icomp-colab' | 'colabweb';

export interface MoodleInstanceInfo {
    id: MoodleInstanceId;
    label: string;
}

/**
 * Fixed allow-list of Moodle instances the API will enqueue jobs for.
 * Deliberately not resolved from client input beyond picking one of these
 * ids — the actual base URL only lives in workers/moodle's own registry, so
 * a client can never smuggle an arbitrary host through this path.
 *
 * 'ufam-virtual' is pending: not yet confirmed working (see
 * workers/moodle/src/config/moodle-instances.ts for the full note).
 */
export const MOODLE_INSTANCES: readonly MoodleInstanceInfo[] = [
    { id: 'icomp-colab', label: 'Colab ICOMP' },
    { id: 'colabweb', label: 'ColabWeb' }
];

const VALID_INSTANCE_IDS = new Set<string>(MOODLE_INSTANCES.map((instance) => instance.id));

export function isMoodleInstanceId(value: string): value is MoodleInstanceId {
    return VALID_INSTANCE_IDS.has(value);
}

export type MoodleInstanceId = 'icomp-colab' | 'colabweb';

export interface MoodleInstanceConfig {
    baseUrl: string;
    label: string;
}

/**
 * Fixed allow-list of Moodle instances this service knows how to talk to.
 * Deliberately never resolved from client input — accepting an arbitrary
 * base URL from a caller would turn this worker into an open SSRF proxy.
 * Add a new instance here only after manually confirming its mobile web
 * service (`login/token.php`) is actually enabled.
 *
 * 'ufam-virtual' (https://ufamvirtual.ufam.edu.br) is pending: Matheus
 * doesn't have an account there yet and the unauthenticated probe of
 * tool_mobile_get_public_config came back inconclusive. Add it once
 * confirmed with real credentials.
 */
export const MOODLE_INSTANCES: Record<MoodleInstanceId, MoodleInstanceConfig> = {
    'icomp-colab': { baseUrl: 'https://colab.icomp.ufam.edu.br', label: 'Colab ICOMP' },
    colabweb: { baseUrl: 'https://colabweb.ufam.edu.br', label: 'ColabWeb' }
};

export function resolveMoodleInstance(instanceId: MoodleInstanceId): MoodleInstanceConfig {
    const instance = MOODLE_INSTANCES[instanceId];
    if (!instance) {
        throw new Error(`Unknown Moodle instance: ${instanceId}`);
    }

    return instance;
}

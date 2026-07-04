import { createHmac } from 'crypto';
import { deriveKey } from '@/shared/security/derive-key';

const PURPOSE = 'pseudonymous-user-id-v1';
let cachedSubkey: Buffer | undefined;

/**
 * Derives a stable, non-reversible identifier for a CPF without needing a
 * database to persist a mapping. Same CPF always yields the same output, so
 * it is safe to use for correlation (e.g. WebSocket room names) without
 * exposing the raw CPF in logs, traces, or observability tooling.
 *
 * The HMAC key is a subkey derived from ECAMPUS_JWT_SECRET (never the raw
 * secret itself), so this is cryptographically isolated from JWT signing:
 * rotating the JWT secret rotates this subkey too, but the two purposes
 * never share a key directly.
 */
export function pseudonymousUserId(cpf: string): string {
    return createHmac('sha256', getSubkey()).update(cpf).digest('hex').slice(0, 32);
}

function getSubkey(): Buffer {
    if (cachedSubkey) {
        return cachedSubkey;
    }

    const secret = process.env.ECAMPUS_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('CRITICAL: ECAMPUS_JWT_SECRET or JWT_SECRET must be defined.');
    }

    cachedSubkey = deriveKey(secret, PURPOSE);
    return cachedSubkey;
}

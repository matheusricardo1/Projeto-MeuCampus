import { deriveKey } from '@/shared/security/derive-key';
import { decryptJson, encryptJson } from '@/shared/security/aes-gcm-cipher';

const PURPOSE = 'moodle-account-v1';
let cachedKey: Buffer | undefined;

/**
 * Encrypts/decrypts a linked Moodle account's password at rest (AES-256-GCM).
 * This is the only place in the system a raw password is ever persisted —
 * everywhere else (eCampus, RU Digital, the Moodle app-session flow) only
 * caches an ephemeral session, never the password. Deliberately keyed by its
 * own secret (MOODLE_ACCOUNT_ENCRYPTION_KEY), never shared with the
 * cache/queue-payload ciphers workers/moodle uses, so rotating one never
 * silently rotates the other.
 */
export function encryptAccountSecret(value: string): string {
    return encryptJson(getKey(), value);
}

export function decryptAccountSecret(raw: string): string {
    return decryptJson<string>(getKey(), raw);
}

function getKey(): Buffer {
    if (cachedKey) {
        return cachedKey;
    }

    const secret = process.env.MOODLE_ACCOUNT_ENCRYPTION_KEY;
    if (!secret) {
        throw new Error('CRITICAL: MOODLE_ACCOUNT_ENCRYPTION_KEY must be defined.');
    }

    cachedKey = deriveKey(secret, PURPOSE);
    return cachedKey;
}

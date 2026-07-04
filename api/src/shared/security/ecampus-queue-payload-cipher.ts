import { deriveKey } from '@/shared/security/derive-key';
import { encryptJson, decryptJson } from '@/shared/security/aes-gcm-cipher';

const PURPOSE = 'ecampus-queue-payload-v1';
let cachedKey: Buffer | undefined;

/**
 * Encrypts/decrypts data that travels through BullMQ job payloads and the
 * login Pub/Sub event (both persisted in Redis in transit). Uses a subkey
 * derived from ECAMPUS_CACHE_ENCRYPTION_KEY distinct from the one used for
 * cache-at-rest, so the two purposes never share key material directly.
 */
export function encryptQueuePayload(value: unknown): string {
    return encryptJson(getKey(), value);
}

export function decryptQueuePayload<T>(raw: string): T {
    return decryptJson<T>(getKey(), raw);
}

function getKey(): Buffer {
    if (cachedKey) {
        return cachedKey;
    }

    const secret = process.env.ECAMPUS_CACHE_ENCRYPTION_KEY;
    if (!secret) {
        throw new Error('CRITICAL: ECAMPUS_CACHE_ENCRYPTION_KEY must be defined.');
    }

    cachedKey = deriveKey(secret, PURPOSE);
    return cachedKey;
}

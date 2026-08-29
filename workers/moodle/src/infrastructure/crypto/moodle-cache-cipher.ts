import { deriveKey } from '@/infrastructure/crypto/derive-key';
import { decryptJson, encryptJson } from '@/infrastructure/crypto/aes-gcm-cipher';

const PURPOSE = 'moodle-cache-v1';
let cachedKey: Buffer | undefined;

/**
 * Encrypts a cache payload before it is written to Redis (AES-256-GCM).
 * Counterpart to decryptCachePayload in the API's MoodleRedisRepository —
 * both sides derive the same subkey from MOODLE_CACHE_ENCRYPTION_KEY.
 */
export function encryptCachePayload(value: unknown): string {
    return encryptJson(getKey(), value);
}

export function decryptCachePayload<T>(raw: string): T {
    return decryptJson<T>(getKey(), raw);
}

function getKey(): Buffer {
    if (cachedKey) {
        return cachedKey;
    }

    const secret = process.env.MOODLE_CACHE_ENCRYPTION_KEY;
    if (!secret) {
        throw new Error('CRITICAL: MOODLE_CACHE_ENCRYPTION_KEY must be defined.');
    }

    cachedKey = deriveKey(secret, PURPOSE);
    return cachedKey;
}

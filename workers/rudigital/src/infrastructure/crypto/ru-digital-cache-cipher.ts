import { deriveKey } from '@/infrastructure/crypto/derive-key';
import { decryptJson, encryptJson } from '@/infrastructure/crypto/aes-gcm-cipher';

const PURPOSE = 'ru-digital-cache-v1';
let cachedKey: Buffer | undefined;

/**
 * Encrypts a cache payload before it is written to Redis (AES-256-GCM).
 * Counterpart to decryptCachePayload in the API's RuDigitalRedisRepository —
 * both sides derive the same subkey from RUDIGITAL_CACHE_ENCRYPTION_KEY.
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

    const secret = process.env.RUDIGITAL_CACHE_ENCRYPTION_KEY;
    if (!secret) {
        throw new Error('CRITICAL: RUDIGITAL_CACHE_ENCRYPTION_KEY must be defined.');
    }

    cachedKey = deriveKey(secret, PURPOSE);
    return cachedKey;
}

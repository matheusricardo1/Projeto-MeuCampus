import { deriveKey } from '@/shared/security/derive-key';
import { decryptJson } from '@/shared/security/aes-gcm-cipher';

const PURPOSE = 'ru-digital-cache-v1';
let cachedKey: Buffer | undefined;

/**
 * Decrypts a cache payload read from Redis (AES-256-GCM). Counterpart to
 * encryptCachePayload in the RU Digital worker's RedisRuDigitalCacheStore —
 * both sides derive the same subkey from RUDIGITAL_CACHE_ENCRYPTION_KEY.
 */
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

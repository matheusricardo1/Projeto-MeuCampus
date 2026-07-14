import { deriveKey } from '@/infrastructure/crypto/derive-key';
import { decryptJson, encryptJson } from '@/infrastructure/crypto/aes-gcm-cipher';

const PURPOSE = 'ecampus-cache-v1';
let cachedKey: Buffer | undefined;

/**
 * Encrypts a cache payload before it is written to Redis (AES-256-GCM).
 * Counterpart to decryptCachePayload in the API's EcampusRedisRepository —
 * both sides derive the same subkey from ECAMPUS_CACHE_ENCRYPTION_KEY.
 */
export function encryptCachePayload(value: unknown): string {
    return encryptJson(getKey(), value);
}

/**
 * Decrypts a cache payload the worker itself previously wrote. The worker is
 * normally write-only against this cache (the API does all the reading), but
 * CacheAndPublishScrapedResource needs to read back the previous value for
 * resources where an empty new result shouldn't blindly overwrite good data.
 */
export function decryptCachePayload<T>(raw: string): T {
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

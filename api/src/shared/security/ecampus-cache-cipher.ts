import { deriveKey } from '@/shared/security/derive-key';
import { decryptJson } from '@/shared/security/aes-gcm-cipher';

const PURPOSE = 'ecampus-cache-v1';
let cachedKey: Buffer | undefined;

/**
 * Decrypts a cache payload read from Redis (AES-256-GCM). Counterpart to
 * encryptCachePayload in the eCampus worker's RedisEcampusCacheStore — both
 * sides derive the same subkey from ECAMPUS_CACHE_ENCRYPTION_KEY.
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

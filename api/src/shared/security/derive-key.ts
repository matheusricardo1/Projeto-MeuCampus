import { createHmac } from 'crypto';

/**
 * Derives a purpose-specific subkey from a root secret via HMAC-SHA256.
 * Keeps unrelated ciphers (cache-at-rest, queue-in-transit, pseudonymization, ...)
 * cryptographically isolated even when they share the same root secret in .env.
 */
export function deriveKey(secret: string, purpose: string): Buffer {
    return createHmac('sha256', secret).update(purpose).digest();
}

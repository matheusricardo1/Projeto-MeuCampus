import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison for credential checks. Hashing both sides
 * to a fixed-length digest first sidesteps timingSafeEqual's requirement
 * that both buffers be the same length (which would otherwise leak the
 * expected credential's length via an early throw).
 */
export function constantTimeEqual(a: string, b: string): boolean {
    const digestA = createHash('sha256').update(a).digest();
    const digestB = createHash('sha256').update(b).digest();
    return timingSafeEqual(digestA, digestB);
}

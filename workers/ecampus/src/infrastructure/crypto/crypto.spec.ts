import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deriveKey } from '@/infrastructure/crypto/derive-key';
import { decryptJson, encryptJson } from '@/infrastructure/crypto/aes-gcm-cipher';
import { encryptCachePayload } from '@/infrastructure/crypto/ecampus-cache-cipher';
import { decryptQueuePayload, encryptQueuePayload } from '@/infrastructure/crypto/ecampus-queue-payload-cipher';

const TEST_SECRET = 'unit-test-secret-do-not-use-in-prod';

describe('deriveKey', () => {
    it('is deterministic for the same secret and purpose', () => {
        expect(deriveKey(TEST_SECRET, 'purpose-a')).toEqual(deriveKey(TEST_SECRET, 'purpose-a'));
    });

    it('isolates different purposes under the same secret', () => {
        const a = deriveKey(TEST_SECRET, 'purpose-a');
        const b = deriveKey(TEST_SECRET, 'purpose-b');
        expect(a.equals(b)).toBe(false);
    });

    it('isolates different secrets under the same purpose', () => {
        const a = deriveKey(TEST_SECRET, 'purpose-a');
        const b = deriveKey('a-completely-different-secret', 'purpose-a');
        expect(a.equals(b)).toBe(false);
    });

    it('matches the known-answer vector for the ecampus-cache-v1 purpose (the API keeps its own independent copy of this same test)', () => {
        const key = deriveKey(TEST_SECRET, 'ecampus-cache-v1');
        expect(key.toString('hex')).toBe('3e5bbe5539a7dc60f1667972faef8c69cdcbfa1c650780de7f1bad7f5bf52a3d');
    });
});

describe('aes-gcm-cipher (encryptJson/decryptJson)', () => {
    const key = deriveKey(TEST_SECRET, 'test-purpose');

    it.each([
        ['string', 'hello'],
        ['number', 42],
        ['object', { a: 1, b: 'two', c: [1, 2, 3] }],
        ['array', [1, 'two', { three: 3 }]],
        ['null', null]
    ])('round-trips a %s value', (_label, value) => {
        const encrypted = encryptJson(key, value);
        expect(decryptJson(key, encrypted)).toEqual(value);
    });

    it('produces different ciphertext for the same value on each call (random IV) but decrypts identically', () => {
        const a = encryptJson(key, { same: true });
        const b = encryptJson(key, { same: true });
        expect(a).not.toBe(b);
        expect(decryptJson(key, a)).toEqual(decryptJson(key, b));
    });

    it('rejects a malformed payload missing the iv/tag/ciphertext parts', () => {
        expect(() => decryptJson(key, 'not-a-valid-payload')).toThrow('Invalid encrypted payload.');
    });

    it('rejects a payload decrypted with the wrong key', () => {
        const encrypted = encryptJson(key, { secret: 'value' });
        const wrongKey = deriveKey('a-completely-different-secret', 'test-purpose');
        expect(() => decryptJson(wrongKey, encrypted)).toThrow();
    });

    it('rejects a tampered ciphertext (the auth tag catches modification)', () => {
        const encrypted = encryptJson(key, { secret: 'value' });
        const [iv, tag, ciphertext] = encrypted.split('.');
        const flippedLastChar = ciphertext!.slice(-1) === 'A' ? 'B' : 'A';
        const tampered = [iv, tag, ciphertext!.slice(0, -1) + flippedLastChar].join('.');
        expect(() => decryptJson(key, tampered)).toThrow();
    });
});

describe('ecampus-cache-cipher (worker encrypt side)', () => {
    beforeAll(() => {
        process.env.ECAMPUS_CACHE_ENCRYPTION_KEY = TEST_SECRET;
    });

    it('encrypts a payload decryptable by anyone deriving the same ecampus-cache-v1 subkey — this is exactly what the API\'s independent decryptCachePayload does on the other side', () => {
        const payload = { grades: [{ code: 'X1', score: '8.5' }] };
        const encrypted = encryptCachePayload(payload);

        const key = deriveKey(TEST_SECRET, 'ecampus-cache-v1');
        expect(decryptJson(key, encrypted)).toEqual(payload);
    });
});

describe('ecampus-queue-payload-cipher', () => {
    beforeAll(() => {
        process.env.ECAMPUS_CACHE_ENCRYPTION_KEY = TEST_SECRET;
    });

    it('round-trips a payload through encrypt/decrypt', () => {
        const payload = { session: { token: 'abc' } };
        const encrypted = encryptQueuePayload(payload);
        expect(decryptQueuePayload(encrypted)).toEqual(payload);
    });

    it('is cryptographically isolated from the cache-cipher purpose: a cache-derived key cannot decrypt a queue-payload ciphertext', () => {
        const encrypted = encryptQueuePayload({ session: { token: 'abc' } });
        const cacheKey = deriveKey(TEST_SECRET, 'ecampus-cache-v1');
        expect(() => decryptJson(cacheKey, encrypted)).toThrow();
    });
});

describe('key derivation fails fast when misconfigured', () => {
    const ORIGINAL_ENV = process.env.ECAMPUS_CACHE_ENCRYPTION_KEY;

    afterAll(() => {
        if (ORIGINAL_ENV === undefined) {
            delete process.env.ECAMPUS_CACHE_ENCRYPTION_KEY;
        } else {
            process.env.ECAMPUS_CACHE_ENCRYPTION_KEY = ORIGINAL_ENV;
        }
    });

    it('throws instead of silently encrypting with an undefined secret when ECAMPUS_CACHE_ENCRYPTION_KEY is missing', async () => {
        delete process.env.ECAMPUS_CACHE_ENCRYPTION_KEY;
        vi.resetModules();
        const freshModule = await import('./ecampus-cache-cipher.js');

        expect(() => freshModule.encryptCachePayload({ any: 'value' }))
            .toThrow('CRITICAL: ECAMPUS_CACHE_ENCRYPTION_KEY must be defined.');
    });
});

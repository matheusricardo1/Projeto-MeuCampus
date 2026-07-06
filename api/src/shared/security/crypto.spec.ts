import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deriveKey } from '@/shared/security/derive-key';
import { decryptJson, encryptJson } from '@/shared/security/aes-gcm-cipher';
import { decryptCachePayload } from '@/shared/security/ecampus-cache-cipher';
import { decryptQueuePayload, encryptQueuePayload } from '@/shared/security/ecampus-queue-payload-cipher';
import { pseudonymousUserId } from '@/shared/security/pseudonymous-user-id';

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

    it('matches the known-answer vector for the ecampus-cache-v1 purpose (the eCampus worker keeps its own independent copy of this same test)', () => {
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

describe('ecampus-cache-cipher (API decrypt side)', () => {
    beforeAll(() => {
        process.env.ECAMPUS_CACHE_ENCRYPTION_KEY = TEST_SECRET;
    });

    it('decrypts a payload encrypted by anyone deriving the same ecampus-cache-v1 subkey — this is exactly what the eCampus worker\'s independent encryptCachePayload produces', () => {
        const payload = { grades: [{ code: 'X1', score: '8.5' }] };
        const key = deriveKey(TEST_SECRET, 'ecampus-cache-v1');
        const encrypted = encryptJson(key, payload);

        expect(decryptCachePayload(encrypted)).toEqual(payload);
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

describe('pseudonymousUserId', () => {
    beforeAll(() => {
        process.env.ECAMPUS_JWT_SECRET = TEST_SECRET;
    });

    it('is deterministic for the same CPF', () => {
        expect(pseudonymousUserId('12345678900')).toBe(pseudonymousUserId('12345678900'));
    });

    it('differs across CPFs', () => {
        expect(pseudonymousUserId('12345678900')).not.toBe(pseudonymousUserId('00987654321'));
    });

    it('never contains the raw CPF as a substring', () => {
        const cpf = '12345678900';
        expect(pseudonymousUserId(cpf)).not.toContain(cpf);
    });

    it('is a fixed-length hex string safe for use as a WebSocket room name', () => {
        const id = pseudonymousUserId('12345678900');
        expect(id).toMatch(/^[0-9a-f]{32}$/);
    });
});

describe('key derivation fails fast when misconfigured', () => {
    const ORIGINAL_CACHE_KEY = process.env.ECAMPUS_CACHE_ENCRYPTION_KEY;
    const ORIGINAL_JWT_SECRET = process.env.ECAMPUS_JWT_SECRET;

    afterAll(() => {
        restoreEnv('ECAMPUS_CACHE_ENCRYPTION_KEY', ORIGINAL_CACHE_KEY);
        restoreEnv('ECAMPUS_JWT_SECRET', ORIGINAL_JWT_SECRET);
    });

    it('throws instead of silently decrypting with an undefined secret when ECAMPUS_CACHE_ENCRYPTION_KEY is missing', async () => {
        delete process.env.ECAMPUS_CACHE_ENCRYPTION_KEY;
        vi.resetModules();
        const freshModule = await import('./ecampus-cache-cipher.js');

        expect(() => freshModule.decryptCachePayload('anything'))
            .toThrow('CRITICAL: ECAMPUS_CACHE_ENCRYPTION_KEY must be defined.');
    });

    it('throws instead of silently pseudonymizing with an undefined secret when ECAMPUS_JWT_SECRET and JWT_SECRET are both missing', async () => {
        delete process.env.ECAMPUS_JWT_SECRET;
        delete process.env.JWT_SECRET;
        vi.resetModules();
        const freshModule = await import('./pseudonymous-user-id.js');

        expect(() => freshModule.pseudonymousUserId('12345678900'))
            .toThrow('CRITICAL: ECAMPUS_JWT_SECRET or JWT_SECRET must be defined.');
    });
});

function restoreEnv(key: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptJson(key: Buffer, value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const serialized = JSON.stringify(value);
    const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptJson<T>(key: Buffer, raw: string): T {
    const [ivPart, authTagPart, encryptedPart] = raw.split('.');
    if (!ivPart || !authTagPart || !encryptedPart) {
        throw new Error('Invalid encrypted payload.');
    }

    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, 'base64url')),
        decipher.final()
    ]).toString('utf8');

    return JSON.parse(decrypted) as T;
}

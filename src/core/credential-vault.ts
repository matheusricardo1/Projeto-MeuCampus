// src/core/credential-vault.ts
import crypto from 'crypto';
import { logger } from './logger';

export class CredentialVault {
    private readonly algorithm = 'aes-256-gcm';
    private readonly key: Buffer;

    constructor() {
        const masterKey = process.env.ECAMPUS_MASTER_KEY;
        if (!masterKey) {
            throw new Error("CRITICAL: ECAMPUS_MASTER_KEY must be defined.");
        }
        this.key = crypto.createHash('sha256').update(masterKey).digest();
    }

    encryptPassword(plainText: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
        
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    decryptPassword(encryptedData: string): string {
        try {
            const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
            if (!ivHex || !authTagHex || !encryptedText) {
                throw new Error("Invalid encrypted password format.");
            }

            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            logger.error("Failed to decrypt password. Master key might have changed.");
            throw new Error("Decryption failed.");
        }
    }
}

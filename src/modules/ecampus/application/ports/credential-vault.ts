export interface CredentialVault {
    encryptPassword(plainText: string): string;
    decryptPassword(encryptedData: string): string;
}

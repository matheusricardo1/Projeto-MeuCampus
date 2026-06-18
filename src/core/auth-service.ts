// src/core/auth-service.ts
import { EcampusClient } from './ecampus-client';
import { SessionRepository } from './session-repository';
import { CredentialVault } from './credential-vault';
import { LoginUseCase } from '../use-cases/login.usecase';
import { AuthenticationError, logger } from './logger';

export class AuthService {
    constructor(
        private readonly sessionRepo: SessionRepository,
        private readonly vault: CredentialVault
    ) {}

    async getAuthenticatedClient(cpf: string, encryptedPassword?: string): Promise<EcampusClient> {
        const client = new EcampusClient();

        // 1. Fast Route
        const savedCookies = await this.sessionRepo.getSession(cpf);
        if (savedCookies) {
            client.importCookies(savedCookies);
        }

        // 2. Validate
        if (await client.isSessionAlive()) {
            return client;
        }

        // 3. Silent Recovery
        logger.info(`Session expired for ${cpf}. Initiating silent recovery...`);
        
        if (!encryptedPassword) {
            throw new AuthenticationError("No encrypted password provided for silent recovery.");
        }

        let realPassword = this.vault.decryptPassword(encryptedPassword);
        
        const loginUsecase = new LoginUseCase(client);
        await loginUsecase.execute(cpf, realPassword);
        
        // Memory clearing (Best effort in JS/V8)
        realPassword = "CLEARED";
        
        const freshCookies = client.exportCookies();
        await this.sessionRepo.saveSession(cpf, freshCookies);
        
        return client;
    }
}

// src/use-cases/login.usecase.ts
import { EcampusClient } from '../core/ecampus-client';
import { AuthenticationError, logger } from '../core/logger';

export class LoginUseCase {
    constructor(private readonly client: EcampusClient) {}

    async execute(cpf: string, password: string): Promise<void> {
        const urlLogin = '/home/loginValida';
        
        const params = new URLSearchParams();
        params.append('usuario', cpf);
        params.append('senha', password);
        params.append('enviar', 'Entrar');

        logger.info(`Attempting authentication for user: ${cpf}`);

        try {
            const response = await this.client.session.post(urlLogin, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 10000
            });

            const html = response.data;
            if (typeof html === 'string' && (html.includes('Acesso ecampus') || response.request.path?.includes('loginValida'))) {
                this.client.isAuthenticated = false;
                logger.error("Authentication failed: Invalid credentials.");
                throw new AuthenticationError("Invalid CPF or password.");
            }

            this.client.isAuthenticated = true;
            logger.info("Authentication successful.");

            await this._setStudentModule();

        } catch (error: any) {
            if (error instanceof AuthenticationError) throw error;
            logger.error(`Connection error during login: ${error.message}`);
            throw error;
        }
    }

    private async _setStudentModule(): Promise<void> {
        const moduleId = 22;
        logger.info(`Changing context to module ID: ${moduleId}`);
        
        await this.client.session.get(`/home/setModulo/${moduleId}`, { timeout: 10000 });
        logger.info(`Module ${moduleId} activated.`);
    }
}

// src/main.ts
import 'dotenv/config';
import { createEcampusModule } from '@ecampus/ecampus.module';
import { logger } from '@ecampus/infrastructure/logging/console-logger';

async function main() {
    const userCpf = process.env.ECAMPUS_CPF;
    const rawPassword = process.env.ECAMPUS_PASSWORD;

    if (!userCpf || !rawPassword) {
        logger.error("Credentials not found in the .env file.");
        return;
    }

    const ecampusModule = createEcampusModule();
    
    // Mocking what comes from your database
    const credentials = {
        cpf: userCpf,
        encryptedPassword: ecampusModule.credentialVault.encryptPassword(rawPassword)
    };

    try {
        const profile = await ecampusModule.useCases.getStudentProfile.execute(credentials);
        
        console.log(`\nWelcome back, ${profile.personal.full_name}!`);
        console.log(`Course: ${profile.academic.course}`);
        
    } catch (error: any) {
        logger.critical(`Execution failed: ${error.message}`);
    }
}

main();

// src/main.ts
import 'dotenv/config';
import { logger } from './core/logger';
import { SessionRepository } from './core/session-repository';
import { CredentialVault } from './core/credential-vault';
import { AuthService } from './core/auth-service';
import { GetStudentProfileUseCase } from './use-cases/get-student-profile.usecase';
// import { GetGradesUseCase } from './use-cases/get-grades.usecase';
// import { GetScheduleUseCase } from './use-cases/get-schedule.usecase';
// import { GetLessonPlanUseCase } from './use-cases/get-lesson-plan.usecase';

async function main() {
    const userCpf = process.env.ECAMPUS_CPF;
    const rawPassword = process.env.ECAMPUS_PASSWORD;

    if (!userCpf || !rawPassword) {
        logger.error("Credentials not found in the .env file.");
        return;
    }

    const sessionRepo = new SessionRepository();
    const vault = new CredentialVault();
    const authService = new AuthService(sessionRepo, vault);
    
    // Mocking what comes from your database
    const mockDatabaseRecord = {
        cpf: userCpf,
        encrypted_password: vault.encryptPassword(rawPassword)
    };

    try {
        const encryptedPwd = mockDatabaseRecord.encrypted_password;
        const client = await authService.getAuthenticatedClient(userCpf, encryptedPwd);
        
        await client.session.get('/home/setModulo/22');
        
        const profileUsecase = new GetStudentProfileUseCase(client);
        const profile = await profileUsecase.execute();
        
        console.log(`\nWelcome back, ${profile.personal.full_name}!`);
        console.log(`Course: ${profile.academic.course}`);
        
    } catch (error: any) {
        logger.critical(`Execution failed: ${error.message}`);
    }
}

main();

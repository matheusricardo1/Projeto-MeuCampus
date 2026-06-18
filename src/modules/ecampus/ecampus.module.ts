import { GetGradesUseCase } from '@ecampus/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@ecampus/application/use-cases/get-lesson-plan.usecase';
import { GetScheduleUseCase } from '@ecampus/application/use-cases/get-schedule.usecase';
import { GetStudentProfileUseCase } from '@ecampus/application/use-cases/get-student-profile.usecase';
import { EcampusAuthService } from '@ecampus/infrastructure/ecampus/ecampus-auth-service';
import { EcampusHttpRepository } from '@ecampus/infrastructure/ecampus/ecampus-http.repository';
import { CryptoCredentialVault } from '@ecampus/infrastructure/security/crypto-credential-vault';
import { FileSessionStore } from '@ecampus/infrastructure/storage/file-session-store';

export function createEcampusModule() {
    const sessionStore = new FileSessionStore();
    const credentialVault = new CryptoCredentialVault();
    const authService = new EcampusAuthService(sessionStore, credentialVault);
    const ecampusRepository = new EcampusHttpRepository(authService);

    return {
        credentialVault,
        useCases: {
            getGrades: new GetGradesUseCase(ecampusRepository),
            getLessonPlan: new GetLessonPlanUseCase(ecampusRepository),
            getSchedule: new GetScheduleUseCase(ecampusRepository),
            getStudentProfile: new GetStudentProfileUseCase(ecampusRepository)
        }
    };
}

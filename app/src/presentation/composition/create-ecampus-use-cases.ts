import { ClearAuthSessionUseCase } from '@/application/use-cases/clear-auth-session.usecase';
import { GetAuthSessionUseCase } from '@/application/use-cases/get-auth-session.usecase';
import { GetGradesUseCase } from '@/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@/application/use-cases/get-schedule.usecase';
import { GetStudentProfileUseCase } from '@/application/use-cases/get-student-profile.usecase';
import { LoginEcampusUseCase } from '@/application/use-cases/login-ecampus.usecase';
import { LogoutUseCase } from '@/application/use-cases/logout.usecase';
import { SendAiChatMessageUseCase } from '@/application/use-cases/send-ai-chat-message.usecase';
import { AsyncAuthSessionStore } from '@/infrastructure/auth/async-auth-session-store';
import { EcampusHttpRepository } from '@/infrastructure/http/ecampus-http-repository';

export function createEcampusUseCases() {
    const repository = new EcampusHttpRepository();
    const sessionStore = new AsyncAuthSessionStore();

    return {
        clearAuthSession: new ClearAuthSessionUseCase(sessionStore),
        getAuthSession: new GetAuthSessionUseCase(sessionStore),
        getGrades: new GetGradesUseCase(repository, sessionStore),
        getLessonPlan: new GetLessonPlanUseCase(repository, sessionStore),
        getLessonPlanSubjects: new GetLessonPlanSubjectsUseCase(repository, sessionStore),
        getSchedule: new GetScheduleUseCase(repository, sessionStore),
        getStudentProfile: new GetStudentProfileUseCase(repository, sessionStore),
        login: new LoginEcampusUseCase(repository, sessionStore),
        logout: new LogoutUseCase(repository, sessionStore),
        sendAiChatMessage: new SendAiChatMessageUseCase(repository, sessionStore)
    };
}

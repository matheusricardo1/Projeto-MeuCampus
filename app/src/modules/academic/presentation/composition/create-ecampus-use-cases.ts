import { ClearAuthSessionUseCase } from '@/shared/auth/clear-auth-session.usecase';
import { EnqueueEcampusScrapeJobUseCase } from '@/modules/academic/application/use-cases/enqueue-ecampus-scrape-job.usecase';
import { GetAuthSessionUseCase } from '@/shared/auth/get-auth-session.usecase';
import { GetGradesUseCase } from '@/modules/academic/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@/modules/academic/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@/modules/academic/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@/modules/academic/application/use-cases/get-schedule.usecase';
import { GetStudentProfileUseCase } from '@/modules/academic/application/use-cases/get-student-profile.usecase';
import { LoginEcampusUseCase } from '@/modules/academic/application/use-cases/login-ecampus.usecase';
import { LogoutUseCase } from '@/modules/academic/application/use-cases/logout.usecase';
import { SendAiChatMessageUseCase } from '@/modules/academic/application/use-cases/send-ai-chat-message.usecase';
import { ValidateAuthSessionUseCase } from '@/modules/academic/application/use-cases/validate-auth-session.usecase';
import { AsyncAuthSessionStore } from '@/shared/auth/async-auth-session-store';
import { EcampusHttpRepository } from '@/modules/academic/infrastructure/http/ecampus-http-repository';

export function createEcampusUseCases() {
    const repository = new EcampusHttpRepository();
    const sessionStore = new AsyncAuthSessionStore();

    return {
        clearAuthSession: new ClearAuthSessionUseCase(sessionStore),
        enqueueScrapeJob: new EnqueueEcampusScrapeJobUseCase(repository, sessionStore),
        getAuthSession: new GetAuthSessionUseCase(sessionStore),
        getGrades: new GetGradesUseCase(repository, sessionStore),
        getLessonPlan: new GetLessonPlanUseCase(repository, sessionStore),
        getLessonPlanSubjects: new GetLessonPlanSubjectsUseCase(repository, sessionStore),
        getSchedule: new GetScheduleUseCase(repository, sessionStore),
        getStudentProfile: new GetStudentProfileUseCase(repository, sessionStore),
        login: new LoginEcampusUseCase(repository, sessionStore),
        logout: new LogoutUseCase(repository, sessionStore),
        sendAiChatMessage: new SendAiChatMessageUseCase(repository, sessionStore),
        validateAuthSession: new ValidateAuthSessionUseCase(repository, sessionStore)
    };
}

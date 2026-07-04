import type { EcampusScrapeJobData, EcampusScrapeJobName } from '@/application/ports/ecampus-scrape-job';
import { LoginEcampusSessionUseCase } from '@/application/use-cases/login-ecampus-session.usecase';
import { LogoutEcampusSessionUseCase } from '@/application/use-cases/logout-ecampus-session.usecase';
import { GetStudentProfileUseCase } from '@/application/use-cases/get-student-profile.usecase';
import { GetScheduleUseCase } from '@/application/use-cases/get-schedule.usecase';
import { GetGradesUseCase } from '@/application/use-cases/get-grades.usecase';
import { GetLessonPlanSubjectsUseCase } from '@/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetLessonPlanUseCase } from '@/application/use-cases/get-lesson-plan.usecase';
import { ReportEcampusScrapeFailureUseCase } from '@/application/use-cases/report-ecampus-scrape-failure.usecase';

type AuthenticatedScrapeJobData = Extract<EcampusScrapeJobData, { credentials: unknown }>;

/**
 * Thin router from a BullMQ job name to the use case that actually knows how
 * to perform it. No caching, session, or event logic lives here anymore —
 * see the individual use cases and CacheAndPublishScrapedResource.
 */
export class ProcessEcampusScrapeJobUseCase {
    constructor(
        private readonly login: LoginEcampusSessionUseCase,
        private readonly logout: LogoutEcampusSessionUseCase,
        private readonly getProfile: GetStudentProfileUseCase,
        private readonly getSchedule: GetScheduleUseCase,
        private readonly getGrades: GetGradesUseCase,
        private readonly getLessonPlanSubjects: GetLessonPlanSubjectsUseCase,
        private readonly getLessonPlan: GetLessonPlanUseCase,
        private readonly reportFailure: ReportEcampusScrapeFailureUseCase
    ) {}

    async execute(name: EcampusScrapeJobName, data: EcampusScrapeJobData, jobId?: string): Promise<unknown> {
        if (name === 'login') {
            const { cpf, password } = data as { cpf: string; password: string };
            return this.login.execute(cpf, password, jobId);
        }

        const authenticatedData = data as AuthenticatedScrapeJobData;

        switch (name) {
            case 'logout':
                return this.logout.execute(authenticatedData.credentials);
            case 'profile':
                return this.getProfile.execute(authenticatedData.credentials);
            case 'schedule':
                return this.getSchedule.execute(authenticatedData.credentials);
            case 'grades': {
                const { year, period } = authenticatedData as { year?: string; period?: string };
                return this.getGrades.execute(authenticatedData.credentials, year, period);
            }
            case 'lesson-plan-subjects':
                return this.getLessonPlanSubjects.execute(authenticatedData.credentials);
            case 'lesson-plan': {
                const { planId } = authenticatedData as { planId?: string };
                return this.getLessonPlan.execute(authenticatedData.credentials, planId);
            }
            default:
                throw new Error(`Unsupported eCampus scraping job: ${name}`);
        }
    }

    async handleFailure(name: string, data: EcampusScrapeJobData, error: Error): Promise<boolean> {
        return this.reportFailure.execute(name, data, error);
    }
}

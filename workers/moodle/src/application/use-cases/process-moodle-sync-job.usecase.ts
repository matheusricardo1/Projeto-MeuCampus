import type { MoodleSyncJobData, MoodleSyncJobName } from '@/application/ports/moodle-scrape-job';
import type { MoodleInstanceId } from '@/config/moodle-instances';
import { LoginMoodleSessionUseCase } from '@/application/use-cases/login-moodle-session.usecase';
import { LogoutMoodleSessionUseCase } from '@/application/use-cases/logout-moodle-session.usecase';
import { GetCoursesUseCase } from '@/application/use-cases/get-courses.usecase';
import { GetTimelineUseCase } from '@/application/use-cases/get-timeline.usecase';
import { ReportMoodleSyncFailureUseCase } from '@/application/use-cases/report-moodle-sync-failure.usecase';

type AuthenticatedSyncJobData = Extract<MoodleSyncJobData, { credentials: unknown }>;

/**
 * Thin router from a BullMQ job name to the use case that actually performs
 * it. No caching, session, or event logic lives here — see the individual
 * use cases and CacheAndPublishScrapedResource.
 */
export class ProcessMoodleSyncJobUseCase {
    constructor(
        private readonly login: LoginMoodleSessionUseCase,
        private readonly logout: LogoutMoodleSessionUseCase,
        private readonly getCourses: GetCoursesUseCase,
        private readonly getTimeline: GetTimelineUseCase,
        private readonly reportFailure: ReportMoodleSyncFailureUseCase
    ) {}

    async execute(name: MoodleSyncJobName, data: MoodleSyncJobData, jobId?: string): Promise<unknown> {
        if (name === 'login') {
            const { instanceId, username, password } = data as { instanceId: MoodleInstanceId; username: string; password: string };
            return this.login.execute(instanceId, username, password, jobId);
        }

        const authenticatedData = data as AuthenticatedSyncJobData;

        switch (name) {
            case 'logout':
                return this.logout.execute(authenticatedData.credentials);
            case 'courses':
                return this.getCourses.execute(authenticatedData.credentials);
            case 'timeline':
                return this.getTimeline.execute(authenticatedData.credentials);
            default:
                throw new Error(`Unsupported Moodle sync job: ${name}`);
        }
    }

    async handleFailure(name: string, data: MoodleSyncJobData, error: Error): Promise<boolean> {
        return this.reportFailure.execute(name, data, error);
    }
}

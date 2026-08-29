import { describe, expect, it, vi } from 'vitest';
import { ProcessMoodleSyncJobUseCase } from '@/application/use-cases/process-moodle-sync-job.usecase';
import type { LoginMoodleSessionUseCase } from '@/application/use-cases/login-moodle-session.usecase';
import type { LogoutMoodleSessionUseCase } from '@/application/use-cases/logout-moodle-session.usecase';
import type { GetCoursesUseCase } from '@/application/use-cases/get-courses.usecase';
import type { GetTimelineUseCase } from '@/application/use-cases/get-timeline.usecase';
import type { ReportMoodleSyncFailureUseCase } from '@/application/use-cases/report-moodle-sync-failure.usecase';

const CREDENTIALS = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1', session: { token: 'wstoken-abc' } };

function buildDeps() {
    const login = { execute: vi.fn().mockResolvedValue({ session: {} }) } as unknown as LoginMoodleSessionUseCase;
    const logout = { execute: vi.fn() } as unknown as LogoutMoodleSessionUseCase;
    const getCourses = { execute: vi.fn() } as unknown as GetCoursesUseCase;
    const getTimeline = { execute: vi.fn() } as unknown as GetTimelineUseCase;
    const reportFailure = { execute: vi.fn() } as unknown as ReportMoodleSyncFailureUseCase;
    return { login, logout, getCourses, getTimeline, reportFailure };
}

describe('ProcessMoodleSyncJobUseCase', () => {
    it('routes a "login" job to LoginMoodleSessionUseCase with the flat fields and the jobId', async () => {
        const { login, logout, getCourses, getTimeline, reportFailure } = buildDeps();
        const useCase = new ProcessMoodleSyncJobUseCase(login, logout, getCourses, getTimeline, reportFailure);

        await useCase.execute('login', { instanceId: 'icomp-colab', username: 'matheusricardo1', password: 'secret' }, 'job-1');

        expect(login.execute).toHaveBeenCalledWith('icomp-colab', 'matheusricardo1', 'secret', 'job-1');
    });

    it('routes a "logout" job to LogoutMoodleSessionUseCase with the credentials', async () => {
        const { login, logout, getCourses, getTimeline, reportFailure } = buildDeps();
        const useCase = new ProcessMoodleSyncJobUseCase(login, logout, getCourses, getTimeline, reportFailure);

        await useCase.execute('logout', { credentials: CREDENTIALS });

        expect(logout.execute).toHaveBeenCalledWith(CREDENTIALS);
    });

    it('routes a "courses" job to GetCoursesUseCase', async () => {
        const { login, logout, getCourses, getTimeline, reportFailure } = buildDeps();
        const useCase = new ProcessMoodleSyncJobUseCase(login, logout, getCourses, getTimeline, reportFailure);

        await useCase.execute('courses', { credentials: CREDENTIALS });

        expect(getCourses.execute).toHaveBeenCalledWith(CREDENTIALS);
    });

    it('routes a "timeline" job to GetTimelineUseCase', async () => {
        const { login, logout, getCourses, getTimeline, reportFailure } = buildDeps();
        const useCase = new ProcessMoodleSyncJobUseCase(login, logout, getCourses, getTimeline, reportFailure);

        await useCase.execute('timeline', { credentials: CREDENTIALS });

        expect(getTimeline.execute).toHaveBeenCalledWith(CREDENTIALS);
    });

    it('throws for an unsupported job name', async () => {
        const { login, logout, getCourses, getTimeline, reportFailure } = buildDeps();
        const useCase = new ProcessMoodleSyncJobUseCase(login, logout, getCourses, getTimeline, reportFailure);

        await expect(useCase.execute('unknown-job' as any, { credentials: CREDENTIALS })).rejects.toThrow('Unsupported Moodle sync job: unknown-job');
    });

    it('delegates handleFailure to ReportMoodleSyncFailureUseCase', async () => {
        const { login, logout, getCourses, getTimeline, reportFailure } = buildDeps();
        (reportFailure.execute as any).mockResolvedValue(true);
        const useCase = new ProcessMoodleSyncJobUseCase(login, logout, getCourses, getTimeline, reportFailure);
        const error = new Error('boom');

        const published = await useCase.handleFailure('courses', { credentials: CREDENTIALS }, error);

        expect(reportFailure.execute).toHaveBeenCalledWith('courses', { credentials: CREDENTIALS }, error);
        expect(published).toBe(true);
    });
});

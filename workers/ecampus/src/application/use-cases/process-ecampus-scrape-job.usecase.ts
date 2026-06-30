import type { EcampusAuthenticator } from '@/application/ports/ecampus-authenticator';
import type { EcampusCacheStore } from '@/application/ports/ecampus-cache-store';
import type { EcampusScrapeEventPublisher } from '@/application/ports/ecampus-scrape-event-publisher';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusScrapeJobData, EcampusScrapeJobName } from '@/ecampus-scrape-job';
import type { EcampusCachedResource } from '@/ecampus-cache';
import type { EcampusResourceReadyEvent } from '@/ecampus-scrape-events';
import { getCurrentAcademicPeriod } from '@ecampus/domain/services/current-academic-period';
import type { EcampusRepository } from '@ecampus/domain/repositories/ecampus.repository';

type AuthenticatedScrapeJobData = Extract<EcampusScrapeJobData, { credentials: unknown }>;

export class ProcessEcampusScrapeJobUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly authenticator: EcampusAuthenticator,
        private readonly sessions: EcampusSessionStore,
        private readonly cache: EcampusCacheStore,
        private readonly events: EcampusScrapeEventPublisher
    ) {}

    async execute(name: EcampusScrapeJobName, data: EcampusScrapeJobData): Promise<unknown> {
        if (name === 'login') {
            const { cpf, password } = data as { cpf: string; password: string };
            const session = await this.authenticator.authenticate({ cpf }, password);
            await this.sessions.markActive(cpf);
            return { session };
        }

        const authenticatedData = data as AuthenticatedScrapeJobData;

        switch (name) {
            case 'logout':
                return this.logoutAndClearCache(authenticatedData.credentials);
            case 'profile':
                await this.sessions.assertActive(authenticatedData.credentials.cpf);
                return this.cacheAndPublish('profile', authenticatedData.credentials.cpf, this.repository.getStudentProfile(authenticatedData.credentials));
            case 'schedule':
                await this.sessions.assertActive(authenticatedData.credentials.cpf);
                return this.cacheAndPublish('schedule', authenticatedData.credentials.cpf, this.repository.getSchedule(authenticatedData.credentials));
            case 'grades': {
                await this.sessions.assertActive(authenticatedData.credentials.cpf);
                const { year, period } = this.resolveGradesPeriod(authenticatedData);
                return this.cacheAndPublish('grades', authenticatedData.credentials.cpf, this.repository.getGrades(authenticatedData.credentials, year, period), { year, period });
            }
            case 'lesson-plan-subjects':
                await this.sessions.assertActive(authenticatedData.credentials.cpf);
                return this.cacheAndPublish('lesson-plan-subjects', authenticatedData.credentials.cpf, this.repository.getLessonPlanSubjects(authenticatedData.credentials));
            case 'lesson-plan': {
                await this.sessions.assertActive(authenticatedData.credentials.cpf);
                const planId = this.requireField(authenticatedData, 'planId');
                return this.cacheAndPublish('lesson-plan', authenticatedData.credentials.cpf, this.repository.getLessonPlan(authenticatedData.credentials, planId), { planId });
            }
            default:
                throw new Error(`Unsupported eCampus scraping job: ${name}`);
        }
    }

    async handleFailure(name: string, data: EcampusScrapeJobData, error: Error): Promise<boolean> {
        const resource = this.toCachedResource(name);
        if (!resource || !('credentials' in data)) {
            return false;
        }

        const event = {
            cpf: data.credentials.cpf,
            resource,
            status: 'failed',
            errorName: error.name,
            message: error.message,
            ...this.getEventParameters(resource, data)
        } as const;

        if (error.name === 'AuthenticationError') {
            await Promise.all([
                this.cache.clearUserCache(event.cpf),
                this.sessions.markInvalid(event.cpf, 'authentication-failure')
            ]);
        }

        await this.events.publishFailed(event);
        return true;
    }

    private async logoutAndClearCache(credentials: { cpf: string }): Promise<{ cacheDeletedKeys: number; externalLogout: 'ok' | 'failed' }> {
        let externalLogout: 'ok' | 'failed' = 'ok';

        try {
            await this.repository.logout(credentials);
        } catch {
            externalLogout = 'failed';
        }

        const cacheDeletedKeys = await this.cache.clearUserCache(credentials.cpf);
        await this.sessions.markInvalid(credentials.cpf, 'logout');
        return { cacheDeletedKeys, externalLogout };
    }

    private async cacheAndPublish<T>(
        resource: EcampusCachedResource,
        cpf: string,
        resultPromise: Promise<T>,
        parameters: Pick<EcampusResourceReadyEvent, 'year' | 'period' | 'planId'> = {}
    ): Promise<T> {
        const result = await resultPromise;
        await this.sessions.assertActive(cpf);
        const extra = resource === 'grades'
            ? `${parameters.year}-${parameters.period}`
            : resource === 'lesson-plan'
                ? parameters.planId
                : undefined;

        await this.cache.save(resource, cpf, result, extra);
        await this.events.publishReady({ cpf, resource, ...parameters });
        return result;
    }

    private requireField<T extends string>(data: Record<string, unknown>, field: T): string {
        const value = data[field];
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error(`Missing required job field: ${field}`);
        }

        return value;
    }

    private resolveGradesPeriod(data: Record<string, unknown>): { year: string; period: string } {
        const fallback = getCurrentAcademicPeriod();
        const year = typeof data.year === 'string' && data.year.trim()
            ? data.year.trim()
            : fallback.year;
        const period = typeof data.period === 'string' && data.period.trim()
            ? data.period.trim()
            : fallback.period;

        return { year, period };
    }

    private toCachedResource(name: string): EcampusCachedResource | null {
        return ['profile', 'schedule', 'grades', 'lesson-plan-subjects', 'lesson-plan'].includes(name)
            ? name as EcampusCachedResource
            : null;
    }

    private getEventParameters(
        resource: EcampusCachedResource,
        data: EcampusScrapeJobData
    ): Pick<EcampusResourceReadyEvent, 'year' | 'period' | 'planId'> {
        if (resource === 'grades') {
            return this.resolveGradesPeriod(data);
        }

        if (resource === 'lesson-plan' && 'planId' in data) {
            return { planId: data.planId };
        }

        return {};
    }
}

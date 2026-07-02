import { Platform } from 'react-native';
import type { AuthSession } from '@/domain/entities/auth-session';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/entities/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/domain/entities/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import { EcampusResourcePendingError } from '@/domain/errors/ecampus-resource-pending.error';
import type { EcampusRepository, EcampusScrapeJobType, LoginCredentials, SendAiChatMessageRequest } from '@/domain/repositories/ecampus-repository';

const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';
const DEFAULT_APP_ENV = 'production';

export class EcampusHttpRepository implements EcampusRepository {
    private readonly baseUrl: string;

    constructor(
        baseUrl: string = process.env.EXPO_PUBLIC_ECAMPUS_API_URL
            || process.env.NEXT_PUBLIC_ECAMPUS_API_URL
            || DEFAULT_API_BASE_URL
    ) {
        this.baseUrl = this.normalizeBaseUrl(baseUrl);
    }

    login(credentials: LoginCredentials): Promise<{ jobId: string }> {
        return this.request<{ jobId: string }>('/ecampus/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
    }

    async validateSession(accessToken: string): Promise<void> {
        await this.request<{ status: string }>('/ecampus/session', {
            headers: this.authHeaders(accessToken)
        });
    }

    async logout(accessToken: string): Promise<void> {
        await this.request<{ status: string }>('/ecampus/logout', {
            method: 'POST',
            headers: this.authHeaders(accessToken)
        });
    }

    async enqueueScrapeJob(accessToken: string, type: EcampusScrapeJobType, data: Record<string, unknown> = {}): Promise<void> {
        await this.request<{ jobId: string }>(`/ecampus/jobs/${encodeURIComponent(type)}`, {
            method: 'POST',
            headers: this.authHeaders(accessToken),
            body: JSON.stringify(data)
        });
    }

    async getProfile(accessToken: string): Promise<StudentProfile> {
        const profile = await this.request<StudentProfile>('/ecampus/profile', {
            headers: this.authHeaders(accessToken)
        });

        return {
            ...profile,
            personal: {
                ...profile.personal,
                full_name: toTitleName(profile.personal.full_name)
            }
        };
    }

    getGrades(accessToken: string, year?: string, period?: string): Promise<Grade[]> {
        return this.requestWithCurrentPeriodFallback<Grade[]>('/ecampus/grades', year, period, {
            headers: this.authHeaders(accessToken)
        });
    }

    getSchedule(accessToken: string): Promise<ScheduleClass[]> {
        return this.request<ScheduleClass[]>('/ecampus/schedule', {
            headers: this.authHeaders(accessToken)
        });
    }

    getAcademicSubjects(accessToken: string, year?: string, period?: string): Promise<LessonPlanSubject[]> {
        return this.requestWithCurrentPeriodFallback<LessonPlanSubject[]>('/ecampus/subjects', year, period, {
            headers: this.authHeaders(accessToken)
        });
    }

    getLessonPlanSubjects(accessToken: string): Promise<LessonPlanSubject[]> {
        return this.request<LessonPlanSubject[]>('/ecampus/lesson-plans', {
            headers: this.authHeaders(accessToken)
        });
    }

    getLessonPlan(accessToken: string, planId: string): Promise<LessonPlanItem[]> {
        return this.request<LessonPlanItem[]>(`/ecampus/lesson-plans/${encodeURIComponent(planId)}`, {
            headers: this.authHeaders(accessToken)
        });
    }

    sendAiChatMessage(accessToken: string, input: SendAiChatMessageRequest): Promise<{ jobId: string }> {
        return this.request<{ jobId: string }>('/ai/chat/messages', {
            method: 'POST',
            headers: this.authHeaders(accessToken),
            body: JSON.stringify(input)
        });
    }

    private authHeaders(accessToken: string): HeadersInit {
        return {
            Authorization: `Bearer ${accessToken}`
        };
    }

    private withOptionalAcademicPeriod(path: string, year?: string, period?: string): string {
        if (!year || !period || isCurrentAcademicPeriod(year, period)) {
            return path;
        }

        const params = new URLSearchParams({ year, period });
        return `${path}?${params.toString()}`;
    }

    private async requestWithCurrentPeriodFallback<T>(path: string, year: string | undefined, period: string | undefined, init: RequestInit): Promise<T> {
        const requestPath = this.withOptionalAcademicPeriod(path, year, period);

        try {
            return await this.request<T>(requestPath, init);
        } catch (error) {
            if (requestPath !== path || !isMissingAcademicPeriodError(error)) {
                throw error;
            }

            const current = getCurrentAcademicPeriod();
            const params = new URLSearchParams(current);
            return this.request<T>(`${path}?${params.toString()}`, init);
        }
    }

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        this.assertSecureBaseUrl();

        const requestInit: RequestInit = {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...init.headers
            }
        };

        // Web pode responder 304 sem payload para GET cacheado; forca bypass do cache HTTP.
        if (typeof window !== 'undefined') {
            requestInit.cache = 'no-store';
        }

        const response = await fetch(`${this.baseUrl}${path}`, {
            ...requestInit
        });

        const body = await response.text();
        const payload = body ? JSON.parse(body) : null;

        if (response.status === 202 && payload?.status === 'pending' && typeof payload.resource === 'string') {
            throw new EcampusResourcePendingError(payload.resource);
        }

        if (!response.ok) {
            if (path !== '/ecampus/login' && (response.status === 401 || response.status === 403)) {
                throw new AuthSessionExpiredError('Sua sessao expirou. Entre novamente.');
            }

            const message = payload?.message || 'Falha ao comunicar com o eCampus.';
            throw new Error(Array.isArray(message) ? message.join(', ') : message);
        }

        return payload as T;
    }

    private normalizeBaseUrl(baseUrl: string): string {
        try {
            return new URL(baseUrl).toString().replace(/\/+$/, '');
        } catch {
            return DEFAULT_API_BASE_URL;
        }
    }

    private assertSecureBaseUrl(): void {
        const parsedUrl = new URL(this.baseUrl);
        const isLocalhost = ['localhost', '127.0.0.1', '10.0.2.2'].includes(parsedUrl.hostname);
        const isProduction = getAppEnv() === 'production';

        if (isProduction && parsedUrl.protocol !== 'https:' && !isLocalhost) {
            throw new Error('A API precisa usar HTTPS em producao.');
        }
    }
}

function getAppEnv(): 'development' | 'production' {
    return process.env.EXPO_PUBLIC_APP_ENV === 'development'
        ? 'development'
        : DEFAULT_APP_ENV;
}

function isCurrentAcademicPeriod(year: string, period: string): boolean {
    const current = getCurrentAcademicPeriod();
    return year === current.year && period === current.period;
}

function getCurrentAcademicPeriod(): { year: string; period: string } {
    const now = new Date();
    return {
        year: now.getFullYear().toString(),
        period: now.getMonth() >= 6 ? '2' : '1'
    };
}

function isMissingAcademicPeriodError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    const message = error.message.toLocaleLowerCase('pt-BR');
    return message.includes('ano com 4 digitos') || message.includes('periodo valido');
}

function toTitleName(value: string): string {
    return value
        .toLocaleLowerCase('pt-BR')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/(^|[\s'-])([\p{L}])/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`);
}

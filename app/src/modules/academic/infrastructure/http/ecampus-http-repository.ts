import { Platform } from 'react-native';
import type { AuthSession } from '@/shared/auth/auth-session';
import type { Grade } from '@/modules/academic/domain/entities/grade';
import type { LessonPlanItem } from '@/modules/academic/domain/entities/lesson-plan-item';
import type { LessonPlanSubject } from '@/modules/academic/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/modules/academic/domain/entities/schedule-class';
import type { StudentProfile } from '@/modules/academic/domain/entities/student-profile';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import { EcampusResourcePendingError } from '@/modules/academic/domain/errors/ecampus-resource-pending.error';
import type { EcampusRepository, EcampusScrapeJobType, LoginCredentials, SendAiChatMessageRequest } from '@/modules/academic/domain/repositories/ecampus-repository';
import { AcademicPeriod } from '@/modules/academic/domain/value-objects/academic-period';

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

    async cancelAiChatMessage(accessToken: string, jobId: string): Promise<void> {
        await this.request<{ status: string }>(`/ai/chat/messages/${encodeURIComponent(jobId)}`, {
            method: 'DELETE',
            headers: this.authHeaders(accessToken)
        });
    }

    private authHeaders(accessToken: string): HeadersInit {
        return {
            Authorization: `Bearer ${accessToken}`
        };
    }

    private withOptionalAcademicPeriod(path: string, year?: string, period?: string): string {
        if (!year || !period || AcademicPeriod.guessCurrent().matches(year, period)) {
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

            const current = AcademicPeriod.guessCurrent();
            const params = new URLSearchParams({ year: current.year, period: current.period });
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

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}${path}`, {
                ...requestInit
            });
        } catch {
            // fetch itself throws (not an HTTP error response) when there's no
            // network path to the server at all — offline, DNS failure, the
            // API being unreachable, a timeout, etc.
            throw new Error('Sem conexao com a internet. Verifique sua rede e tente novamente.');
        }

        const body = await response.text();
        let payload: unknown = null;
        if (body) {
            try {
                payload = JSON.parse(body);
            } catch {
                // A non-JSON body means we're not even talking to our API
                // anymore (a proxy/gateway error page, an HTML 502, etc.) —
                // the status code alone still tells us enough to respond.
                throw new Error(response.ok
                    ? 'O servidor respondeu de forma inesperada. Tente novamente em instantes.'
                    : describeHttpFailure(response.status));
            }
        }

        if (response.status === 202 && isPlainObject(payload) && payload.status === 'pending' && typeof payload.resource === 'string') {
            throw new EcampusResourcePendingError(payload.resource);
        }

        if (!response.ok) {
            if (path !== '/ecampus/login' && (response.status === 401 || response.status === 403)) {
                throw new AuthSessionExpiredError('Sua sessao expirou. Entre novamente.');
            }

            const message = isPlainObject(payload) ? payload.message : undefined;
            const resolvedMessage = typeof message === 'string'
                ? message
                : Array.isArray(message)
                    ? message.join(', ')
                    : describeHttpFailure(response.status);
            throw new Error(resolvedMessage);
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function describeHttpFailure(status: number): string {
    if (status === 404) return 'Recurso nao encontrado.';
    if (status >= 500) return 'O servidor esta com problemas no momento. Tente novamente em instantes.';
    return 'Nao foi possivel concluir a solicitacao.';
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

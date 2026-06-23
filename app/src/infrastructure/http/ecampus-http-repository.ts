import { Platform } from 'react-native';
import type { AuthSession } from '@/domain/entities/auth-session';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/entities/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/domain/entities/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import type { EcampusRepository, LoginCredentials } from '@/domain/repositories/ecampus-repository';

const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';

export class EcampusHttpRepository implements EcampusRepository {
    private readonly baseUrl: string;

    constructor(
        baseUrl: string = process.env.EXPO_PUBLIC_ECAMPUS_API_URL
            || process.env.NEXT_PUBLIC_ECAMPUS_API_URL
            || DEFAULT_API_BASE_URL
    ) {
        this.baseUrl = this.normalizeBaseUrl(baseUrl);
    }

    login(credentials: LoginCredentials): Promise<AuthSession> {
        return this.request<AuthSession>('/ecampus/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
    }

    async logout(accessToken: string): Promise<void> {
        await this.request<{ status: string }>('/ecampus/logout', {
            method: 'POST',
            headers: this.authHeaders(accessToken)
        });
    }

    getProfile(accessToken: string): Promise<StudentProfile> {
        return this.request<StudentProfile>('/ecampus/profile', {
            headers: this.authHeaders(accessToken)
        });
    }

    getGrades(accessToken: string, year: string, period: string): Promise<Grade[]> {
        const params = new URLSearchParams({ year, period });
        return this.request<Grade[]>(`/ecampus/grades?${params.toString()}`, {
            headers: this.authHeaders(accessToken)
        });
    }

    getSchedule(accessToken: string): Promise<ScheduleClass[]> {
        return this.request<ScheduleClass[]>('/ecampus/schedule', {
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

    private authHeaders(accessToken: string): HeadersInit {
        return {
            Authorization: `Bearer ${accessToken}`
        };
    }

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        this.assertSecureBaseUrl();

        const response = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...init.headers
            }
        });

        const body = await response.text();
        const payload = body ? JSON.parse(body) : null;

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
        const isProduction = process.env.NODE_ENV === 'production';

        if (isProduction && parsedUrl.protocol !== 'https:' && !isLocalhost) {
            throw new Error('A API precisa usar HTTPS em producao.');
        }
    }
}

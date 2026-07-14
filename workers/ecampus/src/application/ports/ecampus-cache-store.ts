import type { EcampusCachedResource } from '@/domain/value-objects/ecampus-cached-resource';

export interface EcampusCacheStore {
    save<T>(resource: EcampusCachedResource, cpf: string, value: T, extra?: string): Promise<void>;
    get<T>(resource: EcampusCachedResource, cpf: string, extra?: string): Promise<T | null>;
    /**
     * Remembers which year/period eCampus itself resolved as "current" for
     * this student, so the API can answer "what's the current period"
     * without asking eCampus again on every request.
     */
    saveCurrentPeriod(cpf: string, year: string, period: string): Promise<void>;
    clearUserCache(cpf: string): Promise<number>;
}

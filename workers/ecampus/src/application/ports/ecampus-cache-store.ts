import type { EcampusCachedResource } from '@/ecampus-cache';

export interface EcampusCacheStore {
    save<T>(resource: EcampusCachedResource, cpf: string, value: T, extra?: string): Promise<void>;
    clearUserCache(cpf: string): Promise<number>;
}

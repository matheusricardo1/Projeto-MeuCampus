import type { EcampusCachedResource } from '@/domain/value-objects/ecampus-cached-resource';

export interface EcampusCacheStore {
    save<T>(resource: EcampusCachedResource, cpf: string, value: T, extra?: string): Promise<void>;
    clearUserCache(cpf: string): Promise<number>;
}

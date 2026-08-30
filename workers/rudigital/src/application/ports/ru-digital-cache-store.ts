import type { RuDigitalCachedResource } from '@/domain/value-objects/ru-digital-cached-resource';

export interface RuDigitalCacheStore {
    save<T>(resource: RuDigitalCachedResource, cpf: string, value: T, extra?: string): Promise<void>;
    get<T>(resource: RuDigitalCachedResource, cpf: string, extra?: string): Promise<T | null>;
    clearUserCache(cpf: string): Promise<number>;
}

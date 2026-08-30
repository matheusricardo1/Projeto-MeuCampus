import type { RuDigitalCachedResource } from '@/domain/value-objects/ru-digital-cached-resource';

export function getRuDigitalCacheKey(resource: RuDigitalCachedResource, cpf: string, extra?: string): string {
    const base = `rudigital:result:${cpf}:${resource}`;
    return extra ? `${base}:${extra}` : base;
}

export function getRuDigitalUserCachePattern(cpf: string): string {
    return `rudigital:result:${cpf}:*`;
}

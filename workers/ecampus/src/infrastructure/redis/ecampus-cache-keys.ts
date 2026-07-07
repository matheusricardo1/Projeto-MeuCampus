import type { EcampusCachedResource } from '@/domain/value-objects/ecampus-cached-resource';

export function getEcampusCacheKey(resource: EcampusCachedResource, cpf: string, extra?: string): string {
    const base = `ecampus:result:${cpf}:${resource}`;
    return extra ? `${base}:${extra}` : base;
}

export function getEcampusUserCachePattern(cpf: string): string {
    return `ecampus:result:${cpf}:*`;
}

/**
 * Not a scraped resource — a small pointer to whichever year/period eCampus
 * itself last resolved as "current" for this student. Kept under the same
 * key prefix so `getEcampusUserCachePattern` still wipes it on logout.
 */
export function getCurrentPeriodCacheKey(cpf: string): string {
    return `ecampus:result:${cpf}:current-period`;
}

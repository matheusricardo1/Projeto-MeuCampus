import type { AcademicResource } from '@academic/domain/value-objects/academic-resource.value-object';

export type EcampusCachedResource = AcademicResource;

export function getEcampusCacheKey(resource: EcampusCachedResource, cpf: string, extra?: string): string {
    const base = `ecampus:result:${cpf}:${resource}`;
    return extra ? `${base}:${extra}` : base;
}

export function getEcampusUserCachePattern(cpf: string): string {
    return `ecampus:result:${cpf}:*`;
}

/**
 * Not a scraped resource — a small pointer the worker writes to whichever
 * year/period eCampus itself resolved as "current" for this student. Kept
 * under the same key prefix so getEcampusUserCachePattern still wipes it.
 */
export function getCurrentPeriodCacheKey(cpf: string): string {
    return `ecampus:result:${cpf}:current-period`;
}

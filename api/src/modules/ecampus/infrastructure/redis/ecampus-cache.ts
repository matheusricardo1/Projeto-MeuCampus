import type { AcademicResource } from '@academic/domain/models/academic-resource';

export type EcampusCachedResource = AcademicResource;

export function getEcampusCacheKey(resource: EcampusCachedResource, cpf: string, extra?: string): string {
    const base = `ecampus:result:${cpf}:${resource}`;
    return extra ? `${base}:${extra}` : base;
}

export function getEcampusUserCachePattern(cpf: string): string {
    return `ecampus:result:${cpf}:*`;
}

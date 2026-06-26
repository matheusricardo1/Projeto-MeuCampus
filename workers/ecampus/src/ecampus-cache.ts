export type EcampusCachedResource = 'profile' | 'schedule' | 'grades' | 'lesson-plan-subjects' | 'lesson-plan';

export function getEcampusCacheKey(resource: EcampusCachedResource, cpf: string, extra?: string): string {
    const base = `ecampus:result:${cpf}:${resource}`;
    return extra ? `${base}:${extra}` : base;
}

export function getEcampusUserCachePattern(cpf: string): string {
    return `ecampus:result:${cpf}:*`;
}

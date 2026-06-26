import type { EcampusCachedResource } from '@/shared/ecampus-cache';

export const ECAMPUS_SCRAPE_RESULT_CHANNEL = 'ecampus:scrape:result';
export const ECAMPUS_RESOURCE_READY_EVENT = 'ecampus:resource-ready';

export interface EcampusResourceReadyEvent {
    cpf: string;
    resource: EcampusCachedResource;
    year?: string;
    period?: string;
    planId?: string;
}

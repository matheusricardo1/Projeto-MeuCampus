import type { EcampusCachedResource } from './ecampus-cache';

export const ECAMPUS_SCRAPE_RESULT_CHANNEL = 'ecampus:scrape:result';

export interface EcampusResourceReadyEvent {
    cpf: string;
    resource: EcampusCachedResource;
    year?: string;
    period?: string;
    planId?: string;
}

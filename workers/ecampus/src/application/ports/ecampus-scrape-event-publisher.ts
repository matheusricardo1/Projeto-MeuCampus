import type { EcampusResourceFailedEvent, EcampusResourceReadyEvent } from '@/ecampus-scrape-events';

export interface EcampusScrapeEventPublisher {
    publishReady(event: EcampusResourceReadyEvent): Promise<void>;
    publishFailed(event: EcampusResourceFailedEvent): Promise<void>;
}

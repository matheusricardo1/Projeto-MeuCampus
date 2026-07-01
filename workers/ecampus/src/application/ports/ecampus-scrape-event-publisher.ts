import type { EcampusLoginFailedEvent, EcampusLoginReadyEvent, EcampusResourceFailedEvent, EcampusResourceReadyEvent } from '@/ecampus-scrape-events';

export interface EcampusScrapeEventPublisher {
    publishReady(event: EcampusResourceReadyEvent): Promise<void>;
    publishFailed(event: EcampusResourceFailedEvent): Promise<void>;
    publishLoginReady(event: EcampusLoginReadyEvent): Promise<void>;
    publishLoginFailed(event: EcampusLoginFailedEvent): Promise<void>;
}

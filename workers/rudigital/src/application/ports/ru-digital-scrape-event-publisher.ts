import type {
    RuDigitalLoginFailedEvent,
    RuDigitalLoginReadyEvent,
    RuDigitalResourceFailedEvent,
    RuDigitalResourceReadyEvent
} from '@/application/ports/ru-digital-scrape-events';

export interface RuDigitalScrapeEventPublisher {
    publishReady(event: RuDigitalResourceReadyEvent): Promise<void>;
    publishFailed(event: RuDigitalResourceFailedEvent): Promise<void>;
    publishLoginReady(event: RuDigitalLoginReadyEvent): Promise<void>;
    publishLoginFailed(event: RuDigitalLoginFailedEvent): Promise<void>;
}

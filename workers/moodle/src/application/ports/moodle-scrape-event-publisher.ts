import type {
    MoodleLoginFailedEvent,
    MoodleLoginReadyEvent,
    MoodleResourceFailedEvent,
    MoodleResourceReadyEvent
} from '@/application/ports/moodle-scrape-events';

export interface MoodleScrapeEventPublisher {
    publishReady(event: MoodleResourceReadyEvent): Promise<void>;
    publishFailed(event: MoodleResourceFailedEvent): Promise<void>;
    publishLoginReady(event: MoodleLoginReadyEvent): Promise<void>;
    publishLoginFailed(event: MoodleLoginFailedEvent): Promise<void>;
}

import type Redis from 'ioredis';
import type { MoodleScrapeEventPublisher } from '@/application/ports/moodle-scrape-event-publisher';
import type {
    MoodleLoginFailedEvent,
    MoodleLoginReadyEvent,
    MoodleResourceFailedEvent,
    MoodleResourceReadyEvent
} from '@/application/ports/moodle-scrape-events';
import { encryptQueuePayload } from '@/infrastructure/crypto/moodle-queue-payload-cipher';

// Redis-specific wiring detail — the only consumer of this channel name is
// this publisher (and the API's matching subscriber, in its own codebase).
const MOODLE_SYNC_RESULT_CHANNEL = 'moodle:sync:result';

export class RedisMoodleScrapeEventPublisher implements MoodleScrapeEventPublisher {
    constructor(private readonly redis: Redis) {}

    async publishReady(event: MoodleResourceReadyEvent): Promise<void> {
        await this.publish(event);
    }

    async publishFailed(event: MoodleResourceFailedEvent): Promise<void> {
        await this.publish(event);
    }

    async publishLoginReady(event: MoodleLoginReadyEvent): Promise<void> {
        // The session token is a live authentication artifact — never put it
        // on the wire (Pub/Sub) in plain text.
        const { session, ...rest } = event;
        await this.publish({ ...rest, session: encryptQueuePayload(session) });
    }

    async publishLoginFailed(event: MoodleLoginFailedEvent): Promise<void> {
        await this.publish(event);
    }

    private async publish(event: object): Promise<void> {
        await this.redis.publish(MOODLE_SYNC_RESULT_CHANNEL, JSON.stringify(event));
    }
}

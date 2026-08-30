import type Redis from 'ioredis';
import type { RuDigitalScrapeEventPublisher } from '@/application/ports/ru-digital-scrape-event-publisher';
import type {
    RuDigitalLoginFailedEvent,
    RuDigitalLoginReadyEvent,
    RuDigitalResourceFailedEvent,
    RuDigitalResourceReadyEvent
} from '@/application/ports/ru-digital-scrape-events';
import { encryptQueuePayload } from '@/infrastructure/crypto/ru-digital-queue-payload-cipher';

// Redis-specific wiring detail — the only consumer of this channel name is
// this publisher (and the API's matching subscriber, in its own codebase).
const RUDIGITAL_SCRAPE_RESULT_CHANNEL = 'rudigital:scrape:result';

export class RedisRuDigitalScrapeEventPublisher implements RuDigitalScrapeEventPublisher {
    constructor(private readonly redis: Redis) {}

    async publishReady(event: RuDigitalResourceReadyEvent): Promise<void> {
        await this.publish(event);
    }

    async publishFailed(event: RuDigitalResourceFailedEvent): Promise<void> {
        await this.publish(event);
    }

    async publishLoginReady(event: RuDigitalLoginReadyEvent): Promise<void> {
        // The session token is a live authentication artifact — never put it
        // on the wire (Pub/Sub) in plain text.
        const { session, ...rest } = event;
        await this.publish({ ...rest, session: encryptQueuePayload(session) });
    }

    async publishLoginFailed(event: RuDigitalLoginFailedEvent): Promise<void> {
        await this.publish(event);
    }

    private async publish(event: object): Promise<void> {
        await this.redis.publish(RUDIGITAL_SCRAPE_RESULT_CHANNEL, JSON.stringify(event));
    }
}

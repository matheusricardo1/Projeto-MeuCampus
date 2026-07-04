import type Redis from 'ioredis';
import type { EcampusScrapeEventPublisher } from '@/application/ports/ecampus-scrape-event-publisher';
import {
    ECAMPUS_SCRAPE_RESULT_CHANNEL,
    type EcampusLoginFailedEvent,
    type EcampusLoginReadyEvent,
    type EcampusResourceFailedEvent,
    type EcampusResourceReadyEvent
} from '@/ecampus-scrape-events';
import { encryptQueuePayload } from '@/infrastructure/crypto/ecampus-queue-payload-cipher';

export class RedisEcampusScrapeEventPublisher implements EcampusScrapeEventPublisher {
    constructor(private readonly redis: Redis) {}

    async publishReady(event: EcampusResourceReadyEvent): Promise<void> {
        await this.publish(event);
    }

    async publishFailed(event: EcampusResourceFailedEvent): Promise<void> {
        await this.publish(event);
    }

    async publishLoginReady(event: EcampusLoginReadyEvent): Promise<void> {
        // The session cookie jar is a live authentication artifact — never
        // put it on the wire (Pub/Sub) in plain text.
        const { session, ...rest } = event;
        await this.publish({ ...rest, session: encryptQueuePayload(session) });
    }

    async publishLoginFailed(event: EcampusLoginFailedEvent): Promise<void> {
        await this.publish(event);
    }

    private async publish(event: object): Promise<void> {
        await this.redis.publish(ECAMPUS_SCRAPE_RESULT_CHANNEL, JSON.stringify(event));
    }
}

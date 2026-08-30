import type Redis from 'ioredis';
import type { RuDigitalActionMapStore } from '@/application/ports/ru-digital-action-map-store';

// A route's action map only changes when RU Digital ships a new build (new
// chunk filenames), which is infrequent — this TTL is a "revalidate
// occasionally" cadence, not what guarantees correctness. Correctness comes
// from RuDigitalActionResolver invalidating + re-discovering on a failed call.
const ACTION_MAP_TTL_SECONDS = 60 * 60 * 12;

export class RedisRuDigitalActionMapStore implements RuDigitalActionMapStore {
    constructor(private readonly redis: Redis) {}

    async get(route: string): Promise<Record<string, string> | null> {
        const raw = await this.redis.get(this.getKey(route));
        if (!raw) return null;

        try {
            return JSON.parse(raw) as Record<string, string>;
        } catch {
            return null;
        }
    }

    async save(route: string, actionMap: Record<string, string>): Promise<void> {
        await this.redis.set(this.getKey(route), JSON.stringify(actionMap), 'EX', ACTION_MAP_TTL_SECONDS);
    }

    async invalidate(route: string): Promise<void> {
        await this.redis.del(this.getKey(route));
    }

    private getKey(route: string): string {
        return `rudigital:action-map:${route}`;
    }
}

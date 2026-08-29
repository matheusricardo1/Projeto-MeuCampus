import type { MoodleCachedResource } from '@/domain/value-objects/moodle-cached-resource';

export interface MoodleCacheStore {
    save<T>(resource: MoodleCachedResource, identity: string, value: T, extra?: string): Promise<void>;
    get<T>(resource: MoodleCachedResource, identity: string, extra?: string): Promise<T | null>;
    clearUserCache(identity: string): Promise<number>;
}

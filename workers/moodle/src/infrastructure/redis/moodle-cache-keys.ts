import type { MoodleCachedResource } from '@/domain/value-objects/moodle-cached-resource';

export function getMoodleCacheKey(resource: MoodleCachedResource, identity: string, extra?: string): string {
    const base = `moodle:result:${identity}:${resource}`;
    return extra ? `${base}:${extra}` : base;
}

export function getMoodleUserCachePattern(identity: string): string {
    return `moodle:result:${identity}:*`;
}

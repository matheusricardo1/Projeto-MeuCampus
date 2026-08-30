import type { MoodleResource } from '@moodle/domain/value-objects/moodle-resource.value-object';

export function getMoodleCacheKey(resource: MoodleResource, identity: string, extra?: string): string {
    const base = `moodle:result:${identity}:${resource}`;
    return extra ? `${base}:${extra}` : base;
}

export function getMoodleUserCachePattern(identity: string): string {
    return `moodle:result:${identity}:*`;
}

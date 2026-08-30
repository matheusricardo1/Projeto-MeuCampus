import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';
import { moodleIdentity } from '@moodle/application/services/moodle-identity';

export function scrapingJobDedupeKey(credentials: MoodleCredentials, resource: string, suffix?: string): string {
    return ['moodle', moodleIdentity(credentials), resource, suffix].filter(Boolean).join('-');
}

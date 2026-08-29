import type { MoodleCredentials } from '@/domain/value-objects/moodle-credentials';
import type { Course } from '@/domain/entities/course';
import type { TimelineEvent } from '@/domain/entities/timeline-event';

export interface MoodleRepository {
    logout(credentials: MoodleCredentials): Promise<void>;
    getCourses(credentials: MoodleCredentials): Promise<Course[]>;
    getTimeline(credentials: MoodleCredentials): Promise<TimelineEvent[]>;
}

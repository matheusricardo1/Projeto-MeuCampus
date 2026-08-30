import type { Course } from '@moodle/domain/entities/course.entity';
import type { TimelineEvent } from '@moodle/domain/entities/timeline-event.entity';

/**
 * Reads the raw results the worker already synced and cached. Written by
 * the worker only — this is a read side, like AcademicDataRepository /
 * RuDigitalDataRepository. `identity` is `"<instanceId>:<username>"`.
 */
export abstract class MoodleDataRepository {
    abstract getCourses(identity: string): Promise<Course[]>;
    abstract getTimeline(identity: string): Promise<TimelineEvent[]>;
    abstract clearUserCache(identity: string): Promise<number>;
}

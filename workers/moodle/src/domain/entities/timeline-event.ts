export interface TimelineEvent {
    id: number;
    name: string;
    description: string | null;
    courseId: number | null;
    courseName: string | null;
    /** Moodle's `modulename`, e.g. "assign", "quiz", "forum". */
    activityType: string | null;
    url: string | null;
    /** Unix seconds — the deadline/date this event is sorted and surfaced by. */
    dueAt: number | null;
}

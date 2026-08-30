export interface TimelineEvent {
    id: number;
    name: string;
    description: string | null;
    courseId: number | null;
    courseName: string | null;
    activityType: string | null;
    url: string | null;
    dueAt: number | null;
}

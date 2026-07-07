import type { Grade } from './grade';
import type { ScheduleClass } from './schedule-class';

export interface LessonPlanSubject {
    planId: string | null;
    code: string;
    subject: string;
    classIdentifier: string;
    credits: number | null;
    professor: string;
    workloadHours: number | null;
    available: boolean;
    grade?: Grade | null;
    scheduleItems?: ScheduleClass[];
}

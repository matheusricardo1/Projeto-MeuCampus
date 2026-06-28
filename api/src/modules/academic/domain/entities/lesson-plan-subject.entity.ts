import type { Grade } from '@academic/domain/entities/grade.entity';
import type { ScheduleClass } from '@academic/domain/value-objects/schedule-class.value-object';

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

import type { AttendanceSummary, Grade } from './grade';
import type { ScheduleClass } from './schedule-class';

export interface AcademicSubject {
    code: string;
    subject: string;
    classIdentifier: string;
    credits: number | null;
    professor: string;
    workloadHours: number | null;
    planId: string | null;
    available: boolean;
    grade: Grade | null;
    attendance: AttendanceSummary | null;
    scheduleItems: ScheduleClass[];
}

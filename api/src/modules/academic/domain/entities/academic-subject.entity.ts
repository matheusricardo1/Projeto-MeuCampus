import type { AttendanceSummary, Grade } from '@academic/domain/entities/grade.entity';
import type { ScheduleClass } from '@academic/domain/value-objects/schedule-class.value-object';

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

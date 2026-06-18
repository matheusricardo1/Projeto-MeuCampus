import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { Grade } from '@ecampus/domain/models/grade';
import type { LessonPlanItem } from '@ecampus/domain/models/lesson-plan-item';
import type { ScheduleClass } from '@ecampus/domain/models/schedule-class';
import type { StudentProfile } from '@ecampus/domain/models/student-profile';

export interface EcampusRepository {
    getStudentProfile(credentials: EcampusCredentials): Promise<StudentProfile>;
    getGrades(credentials: EcampusCredentials, year: string, period: string): Promise<Grade[]>;
    getSchedule(credentials: EcampusCredentials): Promise<ScheduleClass[]>;
    getLessonPlan(credentials: EcampusCredentials, planId: string): Promise<LessonPlanItem[]>;
}

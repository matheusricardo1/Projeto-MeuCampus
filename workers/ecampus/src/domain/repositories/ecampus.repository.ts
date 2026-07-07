import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/value-objects/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/domain/value-objects/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';

export interface CurrentAcademicPeriod {
    year: string;
    period: string;
}

export interface EcampusRepository {
    logout(credentials: EcampusCredentials): Promise<void>;
    getStudentProfile(credentials: EcampusCredentials): Promise<StudentProfile>;
    /**
     * eCampus's own session already knows which year/period the student is
     * currently enrolled in — it's the pre-selected default on the grades
     * form. Reading it there is authoritative and avoids guessing.
     */
    getCurrentPeriod(credentials: EcampusCredentials): Promise<CurrentAcademicPeriod>;
    getGrades(credentials: EcampusCredentials, year: string, period: string): Promise<Grade[]>;
    getSchedule(credentials: EcampusCredentials): Promise<ScheduleClass[]>;
    getLessonPlanSubjects(credentials: EcampusCredentials): Promise<LessonPlanSubject[]>;
    getLessonPlan(credentials: EcampusCredentials, planId: string): Promise<LessonPlanItem[]>;
}

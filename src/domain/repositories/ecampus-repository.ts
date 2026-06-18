import type { AuthSession } from '@/domain/entities/auth-session';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/entities/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/domain/entities/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';

export interface LoginCredentials {
    user: string;
    password: string;
}

export interface EcampusRepository {
    login(credentials: LoginCredentials): Promise<AuthSession>;
    logout(accessToken: string): Promise<void>;
    getProfile(accessToken: string): Promise<StudentProfile>;
    getGrades(accessToken: string, year: string, period: string): Promise<Grade[]>;
    getSchedule(accessToken: string): Promise<ScheduleClass[]>;
    getLessonPlanSubjects(accessToken: string): Promise<LessonPlanSubject[]>;
    getLessonPlan(accessToken: string, planId: string): Promise<LessonPlanItem[]>;
}

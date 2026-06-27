import type { AcademicSubject } from '@ecampus/domain/models/academic-subject';
import type { Grade } from '@ecampus/domain/models/grade';
import type { LessonPlanItem } from '@ecampus/domain/models/lesson-plan-item';
import type { LessonPlanSubject } from '@ecampus/domain/models/lesson-plan-subject';
import type { ScheduleClass } from '@ecampus/domain/models/schedule-class';
import type { StudentProfile } from '@ecampus/domain/models/student-profile';

/**
 * Reads normalized academic data for the application layer.
 * Implementations may consume fragmented raw payloads, but callers should
 * receive stable domain models.
 */
export abstract class CacheRepository {
  abstract getProfile(cpf: string): Promise<StudentProfile>;
  abstract getSchedule(cpf: string): Promise<ScheduleClass[]>;
  abstract getGrades(cpf: string, year: string, period: string): Promise<Grade[]>;
  abstract getLessonPlanSubjects(cpf: string): Promise<LessonPlanSubject[]>;
  abstract getLessonPlan(cpf: string, planId: string): Promise<LessonPlanItem[]>;
  abstract getAcademicSubjects(cpf: string, year: string, period: string): Promise<AcademicSubject[]>;
  abstract clearUserCache(cpf: string): Promise<number>;
}

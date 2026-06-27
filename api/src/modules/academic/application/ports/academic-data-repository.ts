import type { AcademicSubject } from '@academic/domain/models/academic-subject';
import type { Grade } from '@academic/domain/models/grade';
import type { LessonPlanItem } from '@academic/domain/models/lesson-plan-item';
import type { LessonPlanSubject } from '@academic/domain/models/lesson-plan-subject';
import type { ScheduleClass } from '@academic/domain/models/schedule-class';
import type { StudentProfile } from '@academic/domain/models/student-profile';

/**
 * Reads normalized academic data for the application layer.
 * Implementations may consume fragmented raw payloads, but callers should
 * receive stable domain models.
 */
export abstract class AcademicDataRepository {
  abstract getProfile(cpf: string): Promise<StudentProfile>;
  abstract getSchedule(cpf: string): Promise<ScheduleClass[]>;
  abstract getGrades(cpf: string, year: string, period: string): Promise<Grade[]>;
  abstract getLessonPlanSubjects(cpf: string): Promise<LessonPlanSubject[]>;
  abstract getLessonPlan(cpf: string, planId: string): Promise<LessonPlanItem[]>;
  abstract getAcademicSubjects(cpf: string, year: string, period: string): Promise<AcademicSubject[]>;
  abstract clearUserCache(cpf: string): Promise<number>;
}

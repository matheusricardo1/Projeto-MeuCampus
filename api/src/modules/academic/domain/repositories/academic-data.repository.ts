import type { AcademicSubject } from '@academic/domain/entities/academic-subject.entity';
import type { Grade } from '@academic/domain/entities/grade.entity';
import type { LessonPlanItem } from '@academic/domain/value-objects/lesson-plan-item.value-object';
import type { LessonPlanSubject } from '@academic/domain/entities/lesson-plan-subject.entity';
import type { ScheduleClass } from '@academic/domain/value-objects/schedule-class.value-object';
import type { StudentProfile } from '@academic/domain/entities/student-profile.entity';

export interface CurrentAcademicPeriod {
  year: string;
  period: string;
}

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
  /** The year/period eCampus itself last resolved as "current" for this student, if known yet. */
  abstract getCurrentPeriodHint(cpf: string): Promise<CurrentAcademicPeriod | null>;
  abstract clearUserCache(cpf: string): Promise<number>;
}

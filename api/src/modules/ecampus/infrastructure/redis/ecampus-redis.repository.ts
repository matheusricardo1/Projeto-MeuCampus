import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import { createApiRedisConnectionOptions } from '@/shared/redis-connection';
import { getCurrentPeriodCacheKey, getEcampusCacheKey, getEcampusUserCachePattern, type EcampusCachedResource } from '@ecampus/infrastructure/redis/ecampus-cache';
import type { CurrentAcademicPeriod } from '@academic/domain/repositories/academic-data.repository';
import { decryptCachePayload } from '@/shared/security/ecampus-cache-cipher';
import type { AcademicSubject } from '@academic/domain/entities/academic-subject.entity';
import type { AttendanceSummary, Grade, GradeEvaluation } from '@academic/domain/entities/grade.entity';
import type { LessonPlanItem } from '@academic/domain/value-objects/lesson-plan-item.value-object';
import type { LessonPlanSubject } from '@academic/domain/entities/lesson-plan-subject.entity';
import type { ScheduleClass } from '@academic/domain/value-objects/schedule-class.value-object';
import type { StudentProfile } from '@academic/domain/entities/student-profile.entity';
import { isSameSubject } from '@academic/domain/services/academic-subject-identity';
import { buildAttendanceSummary } from '@academic/domain/services/academic-attendance-policy';
import { reconcileAcademicSubjects } from '@academic/domain/services/academic-subject-reconciler';
import { AcademicPeriod } from '@academic/domain/value-objects/academic-period.value-object';

type UnknownRecord = Record<string, unknown>;

/**
 * Reads the raw page-level results cached by workers and maps them into the
 * domain shapes expected by the application. Parsing raw/untrusted cache
 * payloads into typed domain objects is this repository's own concern —
 * academic/domain never sees anything but already-valid data.
 */
@Injectable()
export class EcampusRedisRepository extends AcademicDataRepository {
  private readonly redis: Redis;

  constructor() {
    super();
    this.redis = new Redis(createApiRedisConnectionOptions());
  }

  async getProfile(cpf: string): Promise<StudentProfile> {
    return this.getRequired<StudentProfile>('profile', cpf);
  }

  async getSchedule(cpf: string): Promise<ScheduleClass[]> {
    return this.parseSchedule(await this.getRequired('schedule', cpf));
  }

  async getGrades(cpf: string, year: string, period: string): Promise<Grade[]> {
    const isCurrentPeriod = await this.isCurrentPeriod(cpf, year, period);

    const [gradesRaw, lessonPlanSubjectsRaw] = await Promise.all([
      this.getRequired('grades', cpf, `${year}-${period}`),
      isCurrentPeriod ? this.getOptional('lesson-plan-subjects', cpf) : Promise.resolve(null)
    ]);

    return this.parseGrades(gradesRaw, lessonPlanSubjectsRaw);
  }

  async getCurrentPeriodHint(cpf: string): Promise<CurrentAcademicPeriod | null> {
    const raw = await this.redis.get(getCurrentPeriodCacheKey(cpf));
    return raw ? decryptCachePayload<CurrentAcademicPeriod>(raw) : null;
  }

  async getLessonPlanSubjects(cpf: string): Promise<LessonPlanSubject[]> {
    const [lessonPlanSubjectsRaw, scheduleRaw] = await Promise.all([
      this.getRequired('lesson-plan-subjects', cpf),
      this.getOptional('schedule', cpf)
    ]);

    const academicSubjects = reconcileAcademicSubjects({
      lessonPlanSubjects: this.parseLessonPlanSubjects(lessonPlanSubjectsRaw),
      schedule: this.parseSchedule(scheduleRaw)
    });

    return academicSubjects.map((subject) => ({
      planId: subject.planId,
      code: subject.code,
      subject: subject.subject,
      classIdentifier: subject.classIdentifier,
      credits: subject.credits,
      professor: subject.professor,
      workloadHours: subject.workloadHours,
      available: subject.available,
      grade: subject.grade,
      scheduleItems: subject.scheduleItems
    }));
  }

  async getLessonPlan(cpf: string, planId: string): Promise<LessonPlanItem[]> {
    return this.getRequired<LessonPlanItem[]>('lesson-plan', cpf, planId);
  }

  async getAcademicSubjects(cpf: string, year: string, period: string): Promise<AcademicSubject[]> {
    const isCurrentPeriod = await this.isCurrentPeriod(cpf, year, period);

    const [gradesRaw, lessonPlanSubjectsRaw, scheduleRaw] = await Promise.all([
      this.getRequired('grades', cpf, `${year}-${period}`),
      isCurrentPeriod ? this.getOptional('lesson-plan-subjects', cpf) : Promise.resolve(null),
      isCurrentPeriod ? this.getOptional('schedule', cpf) : Promise.resolve(null)
    ]);

    return reconcileAcademicSubjects({
      grades: this.parseGrades(gradesRaw, lessonPlanSubjectsRaw),
      lessonPlanSubjects: this.parseLessonPlanSubjects(lessonPlanSubjectsRaw),
      schedule: this.parseSchedule(scheduleRaw)
    });
  }

  async clearUserCache(cpf: string): Promise<number> {
    const pattern = getEcampusUserCachePattern(cpf);
    let cursor = '0';
    let deletedKeys = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deletedKeys += await this.redis.del(...keys);
      }
    } while (cursor !== '0');

    return deletedKeys;
  }

  private async getRequired<T = unknown>(resource: EcampusCachedResource, cpf: string, extra?: string): Promise<T> {
    const raw = await this.redis.get(getEcampusCacheKey(resource, cpf, extra));
    if (!raw) {
      throw new AcademicResourceNotFoundException(resource);
    }

    return decryptCachePayload<T>(raw);
  }

  private async getOptional<T = unknown>(resource: EcampusCachedResource, cpf: string, extra?: string): Promise<T | null> {
    const raw = await this.redis.get(getEcampusCacheKey(resource, cpf, extra));
    return raw ? decryptCachePayload<T>(raw) : null;
  }

  /**
   * Whether year/period is the student's actual current term — used to
   * decide whether to enrich grades with schedule/lesson-plan-subjects data
   * that's only meaningful for the term in progress. Prefers the real
   * period eCampus resolved; only falls back to a calendar guess before
   * that's ever been discovered (e.g. the very first request of a session).
   */
  private async isCurrentPeriod(cpf: string, year: string, period: string): Promise<boolean> {
    const hint = await this.getCurrentPeriodHint(cpf) ?? AcademicPeriod.guessCurrent();
    return year === hint.year && period === hint.period;
  }

  // ---------------------------------------------------------------------
  // Raw cache payload → domain object mapping. This cache is only ever
  // written by our own worker, but it crosses a JSON (de)serialization
  // boundary between two independently-deployed processes with no runtime
  // schema check (decryptCachePayload<T> is an unchecked cast) — so every
  // field is read defensively here rather than trusted.
  // ---------------------------------------------------------------------

  private parseGrades(raw: unknown, lessonPlanSubjectsRaw: unknown): Grade[] {
    const lessonPlanSubjects = this.parseLessonPlanSubjects(lessonPlanSubjectsRaw);

    return this.toArray(raw).map((item) => {
      const record = this.toRecord(item);
      const code = this.readString(record, 'code');
      const classIdentifier = this.readString(record, 'class_identifier') || this.readString(record, 'classIdentifier');
      const subject = this.readString(record, 'subject');
      const matchingSubject = this.findLessonPlanSubject(lessonPlanSubjects, code, classIdentifier, subject);
      const attendance = this.parseAttendance(record.attendance);
      const workloadHours = attendance?.workload_hours ?? matchingSubject?.workloadHours ?? null;
      const absences = this.readString(record, 'absences');

      return {
        code,
        subject: subject || matchingSubject?.subject || '',
        class_identifier: classIdentifier || matchingSubject?.classIdentifier || '',
        evaluations: this.parseEvaluations(record.evaluations),
        exercise_average: this.readString(record, 'exercise_average') || this.readString(record, 'exerciseAverage'),
        final_exam: this.readString(record, 'final_exam') || this.readString(record, 'finalExam'),
        final_grade: this.readString(record, 'final_grade') || this.readString(record, 'finalGrade'),
        absences,
        attendance: buildAttendanceSummary(attendance, workloadHours, absences),
        status: this.readString(record, 'status')
      };
    });
  }

  private parseLessonPlanSubjects(raw: unknown): LessonPlanSubject[] {
    return this.toArray(raw).map((item) => {
      const record = this.toRecord(item);
      return {
        planId: this.readNullableString(record, 'planId'),
        code: this.readString(record, 'code'),
        subject: this.readString(record, 'subject'),
        classIdentifier: this.readString(record, 'classIdentifier') || this.readString(record, 'class_identifier'),
        credits: this.readNullableNumber(record, 'credits'),
        professor: this.readString(record, 'professor'),
        workloadHours: this.readNullableNumber(record, 'workloadHours') ?? this.readNullableNumber(record, 'workload_hours'),
        available: this.readBoolean(record, 'available')
      };
    });
  }

  private parseSchedule(raw: unknown): ScheduleClass[] {
    return this.toArray(raw).map((item) => {
      const record = this.toRecord(item);
      return {
        weekday: this.readString(record, 'weekday'),
        start_time: this.readString(record, 'start_time') || this.readString(record, 'startTime'),
        end_time: this.readString(record, 'end_time') || this.readString(record, 'endTime'),
        code: this.readString(record, 'code'),
        subject: this.readString(record, 'subject'),
        class_identifier: this.readString(record, 'class_identifier') || this.readString(record, 'classIdentifier')
      };
    });
  }

  private parseEvaluations(raw: unknown): GradeEvaluation[] {
    return this.toArray(raw).map((item) => {
      const record = this.toRecord(item);
      return {
        weight: this.readString(record, 'weight'),
        score: this.readString(record, 'score')
      };
    });
  }

  private parseAttendance(raw: unknown): AttendanceSummary | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const record = raw as UnknownRecord;
    return {
      workload_hours: this.readNullableNumber(record, 'workload_hours') ?? this.readNullableNumber(record, 'workloadHours'),
      absences_hours: this.readNumber(record, 'absences_hours') || this.readNumber(record, 'absencesHours'),
      max_absences_allowed: this.readNullableNumber(record, 'max_absences_allowed') ?? this.readNullableNumber(record, 'maxAbsencesAllowed'),
      minimum_presence_hours: this.readNullableNumber(record, 'minimum_presence_hours') ?? this.readNullableNumber(record, 'minimumPresenceHours'),
      presence_hours: this.readNullableNumber(record, 'presence_hours') ?? this.readNullableNumber(record, 'presenceHours'),
      presence_percent: this.readNullableNumber(record, 'presence_percent') ?? this.readNullableNumber(record, 'presencePercent'),
      is_absence_risk: this.readNullableBoolean(record, 'is_absence_risk') ?? this.readNullableBoolean(record, 'isAbsenceRisk'),
      source: record.source === 'computed' ? 'computed' : 'missing_workload'
    };
  }

  private findLessonPlanSubject(
    subjects: LessonPlanSubject[],
    code: string,
    classIdentifier: string,
    subject: string
  ): LessonPlanSubject | undefined {
    return subjects.find((item) => isSameSubject(item, code, classIdentifier, subject));
  }

  private toArray(raw: unknown): unknown[] {
    return Array.isArray(raw) ? raw : [];
  }

  private toRecord(raw: unknown): UnknownRecord {
    return raw && typeof raw === 'object' ? raw as UnknownRecord : {};
  }

  private readString(record: UnknownRecord, key: string): string {
    const value = record[key];
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    return '';
  }

  private readNullableString(record: UnknownRecord, key: string): string | null {
    const value = this.readString(record, key);
    return value ? value : null;
  }

  private readNumber(record: UnknownRecord, key: string): number {
    return this.readNullableNumber(record, key) ?? 0;
  }

  private readNullableNumber(record: UnknownRecord, key: string): number | null {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private readBoolean(record: UnknownRecord, key: string): boolean {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
  }

  private readNullableBoolean(record: UnknownRecord, key: string): boolean | null {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return null;
  }
}

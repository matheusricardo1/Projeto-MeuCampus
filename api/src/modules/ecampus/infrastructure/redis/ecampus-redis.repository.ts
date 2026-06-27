import { Injectable, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheRepository } from '@/modules/ecampus/application/ports/cache-repository';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { getEcampusCacheKey, getEcampusUserCachePattern, type EcampusCachedResource } from '@/shared/ecampus-cache';
import type { AcademicSubject } from '@ecampus/domain/models/academic-subject';
import type { Grade } from '@ecampus/domain/models/grade';
import type { LessonPlanItem } from '@ecampus/domain/models/lesson-plan-item';
import type { LessonPlanSubject } from '@ecampus/domain/models/lesson-plan-subject';
import type { ScheduleClass } from '@ecampus/domain/models/schedule-class';
import type { StudentProfile } from '@ecampus/domain/models/student-profile';
import {
  normalizeAcademicSubjects,
  normalizeGrades,
  normalizeLessonPlanSubjects,
  normalizeSchedule
} from '@ecampus/domain/services/academic-subject-normalizer';

/**
 * Reads the raw page-level results saved by workers and maps them into the
 * domain shapes expected by the application.
 */
@Injectable()
export class EcampusRedisRepository extends CacheRepository {
  private readonly redis: Redis;

  constructor() {
    super();
    this.redis = new Redis(createRedisConnectionOptions());
  }

  async getProfile(cpf: string): Promise<StudentProfile> {
    return this.getRequired<StudentProfile>('profile', cpf);
  }

  async getSchedule(cpf: string): Promise<ScheduleClass[]> {
    return normalizeSchedule(await this.getRequired('schedule', cpf));
  }

  async getGrades(cpf: string, year: string, period: string): Promise<Grade[]> {
    const [grades, lessonPlanSubjects] = await Promise.all([
      this.getRequired('grades', cpf, `${year}-${period}`),
      this.getOptional('lesson-plan-subjects', cpf)
    ]);

    return normalizeGrades(grades, lessonPlanSubjects);
  }

  async getLessonPlanSubjects(cpf: string): Promise<LessonPlanSubject[]> {
    const [lessonPlanSubjects, schedule] = await Promise.all([
      this.getRequired('lesson-plan-subjects', cpf),
      this.getOptional('schedule', cpf)
    ]);

    const academicSubjects = normalizeAcademicSubjects({
      lessonPlanSubjects,
      schedule
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
    const [grades, lessonPlanSubjects, schedule] = await Promise.all([
      this.getRequired('grades', cpf, `${year}-${period}`),
      this.getOptional('lesson-plan-subjects', cpf),
      this.getOptional('schedule', cpf)
    ]);

    return normalizeAcademicSubjects({
      grades,
      lessonPlanSubjects,
      schedule
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
      throw new NotFoundException(`No cached result for ${resource}`);
    }

    return JSON.parse(raw) as T;
  }

  private async getOptional<T = unknown>(resource: EcampusCachedResource, cpf: string, extra?: string): Promise<T | null> {
    const raw = await this.redis.get(getEcampusCacheKey(resource, cpf, extra));
    return raw ? JSON.parse(raw) as T : null;
  }
}

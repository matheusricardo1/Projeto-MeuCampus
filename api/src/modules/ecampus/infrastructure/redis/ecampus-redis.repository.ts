import { Injectable, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { createRedisConnectionOptions } from '@/shared/redis-connection';
import { getEcampusCacheKey, getEcampusUserCachePattern, type EcampusCachedResource } from '@/shared/ecampus-cache';

/**
 * Simple read‑only repository that fetches data that the worker stored in Redis.
 * The cache TTL is 1 hour (set by the worker). If a key is missing we throw
 * a NotFoundException – the controller can decide to enqueue a job instead.
 */
@Injectable()
export class EcampusRedisRepository {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(createRedisConnectionOptions());
  }

  async get<T>(resource: EcampusCachedResource, cpf: string, extra?: string): Promise<T> {
    const raw = await this.redis.get(getEcampusCacheKey(resource, cpf, extra));
    if (!raw) {
      throw new NotFoundException(`No cached result for ${resource}`);
    }
    return JSON.parse(raw) as T;
  }

  // Convenience helpers used by the controller (typed)
  async getProfile(cpf: string) {
    return this.get<any>('profile', cpf);
  }
  async getSchedule(cpf: string) {
    return this.get<any>('schedule', cpf);
  }
  async getGrades(cpf: string, year: string, period: string) {
    return this.get<any>('grades', cpf, `${year}-${period}`);
  }
  async getLessonPlanSubjects(cpf: string) {
    return this.get<any>('lesson-plan-subjects', cpf);
  }
  async getLessonPlan(cpf: string, planId: string) {
    return this.get<any>('lesson-plan', cpf, planId);
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
}

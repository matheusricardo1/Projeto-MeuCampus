import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { MoodleDataRepository } from '@moodle/domain/repositories/moodle-data.repository';
import { MoodleResourceNotFoundException } from '@moodle/domain/exceptions/moodle-resource-not-found.exception';
import { createApiRedisConnectionOptions } from '@/shared/redis-connection';
import { getMoodleCacheKey, getMoodleUserCachePattern } from '@moodle/infrastructure/redis/moodle-cache-keys';
import { decryptCachePayload } from '@/shared/security/moodle-cache-cipher';
import type { Course } from '@moodle/domain/entities/course.entity';
import type { TimelineEvent } from '@moodle/domain/entities/timeline-event.entity';

type UnknownRecord = Record<string, unknown>;

/**
 * Reads the results the Moodle worker already synced and cached — the
 * worker already writes these in the exact domain shape, so this repository
 * only needs to read them back defensively (the JSON round-trip through
 * Redis crosses an independently-deployed-process boundary with no runtime
 * schema check).
 */
@Injectable()
export class MoodleRedisRepository extends MoodleDataRepository {
    private readonly redis: Redis;

    constructor() {
        super();
        this.redis = new Redis(createApiRedisConnectionOptions());
    }

    async getCourses(identity: string): Promise<Course[]> {
        const raw = await this.getRequired<unknown>('courses', identity);
        return this.toArray(raw).map((item) => {
            const record = this.toRecord(item);
            return {
                id: this.readNumber(record, 'id'),
                shortName: this.readString(record, 'shortName'),
                fullName: this.readString(record, 'fullName'),
                displayName: this.readString(record, 'displayName') || this.readString(record, 'fullName'),
                imageUrl: this.readNullableString(record, 'imageUrl'),
                progress: this.readNullableNumber(record, 'progress'),
                startDate: this.readNumber(record, 'startDate'),
                endDate: this.readNullableNumber(record, 'endDate'),
                visible: record.visible === true
            };
        });
    }

    async getTimeline(identity: string): Promise<TimelineEvent[]> {
        const raw = await this.getRequired<unknown>('timeline', identity);
        return this.toArray(raw).map((item) => {
            const record = this.toRecord(item);
            return {
                id: this.readNumber(record, 'id'),
                name: this.readString(record, 'name'),
                description: this.readNullableString(record, 'description'),
                courseId: this.readNullableNumber(record, 'courseId'),
                courseName: this.readNullableString(record, 'courseName'),
                activityType: this.readNullableString(record, 'activityType'),
                url: this.readNullableString(record, 'url'),
                dueAt: this.readNullableNumber(record, 'dueAt')
            };
        });
    }

    async clearUserCache(identity: string): Promise<number> {
        const pattern = getMoodleUserCachePattern(identity);
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

    private async getRequired<T>(resource: 'courses' | 'timeline', identity: string, extra?: string): Promise<T> {
        const raw = await this.redis.get(getMoodleCacheKey(resource, identity, extra));
        if (!raw) {
            throw new MoodleResourceNotFoundException(resource);
        }

        return decryptCachePayload<T>(raw);
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
        const value = record[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }

    private readNullableNumber(record: UnknownRecord, key: string): number | null {
        const value = record[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }
}

import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import { createApiRedisConnectionOptions } from '@/shared/redis-connection';
import { getRuDigitalCacheKey, getRuDigitalUserCachePattern } from '@ru-digital/infrastructure/redis/ru-digital-cache-keys';
import { decryptCachePayload } from '@/shared/security/ru-digital-cache-cipher';
import type { Student } from '@ru-digital/domain/entities/student.entity';
import type { Balance, MealBalance } from '@ru-digital/domain/entities/balance.entity';
import type { DailyMenu } from '@ru-digital/domain/entities/daily-menu.entity';
import type { Restaurant } from '@ru-digital/domain/entities/restaurant.entity';
import type { LastConsumption } from '@ru-digital/domain/entities/last-consumption.entity';

type UnknownRecord = Record<string, unknown>;

/**
 * Reads the results the RU Digital worker already scraped and cached — the
 * worker maps RU Digital's raw (Portuguese) wire shapes into these English
 * domain entities before caching, so this repository only needs to read
 * them back defensively (the JSON round-trip through Redis crosses an
 * independently-deployed-process boundary with no runtime schema check).
 */
@Injectable()
export class RuDigitalRedisRepository extends RuDigitalDataRepository {
    private readonly redis: Redis;

    constructor() {
        super();
        this.redis = new Redis(createApiRedisConnectionOptions());
    }

    async getStudent(cpf: string): Promise<Student> {
        const raw = await this.getRequired<UnknownRecord>('discente', cpf);
        return {
            studentId: this.readNumber(raw, 'studentId'),
            courseEnrollmentId: this.readNumber(raw, 'courseEnrollmentId'),
            cpf: this.readString(raw, 'cpf'),
            fullName: this.readString(raw, 'fullName'),
            enrollmentNumber: this.readString(raw, 'enrollmentNumber'),
            courseCode: this.readString(raw, 'courseCode'),
            courseName: this.readString(raw, 'courseName')
        };
    }

    async getBalance(cpf: string): Promise<Balance> {
        const raw = await this.getRequired<UnknownRecord>('saldo', cpf);
        return {
            breakfast: this.readMealBalance(raw, 'breakfast'),
            lunch: this.readMealBalance(raw, 'lunch'),
            dinner: this.readMealBalance(raw, 'dinner')
        };
    }

    async getDailyMenu(cpf: string, date: string): Promise<DailyMenu> {
        const raw = await this.getRequired<UnknownRecord>('cardapio', cpf, date);
        return {
            date: this.readString(raw, 'date') || date,
            restaurantId: this.readString(raw, 'restaurantId'),
            mealId: this.readString(raw, 'mealId'),
            items: this.readStringArray(raw, 'items')
        };
    }

    async getDefaultRestaurant(cpf: string): Promise<Restaurant> {
        const raw = await this.getRequired<UnknownRecord>('restaurante', cpf);
        return {
            id: this.readString(raw, 'id'),
            name: this.readString(raw, 'name'),
            city: this.readString(raw, 'city')
        };
    }

    async getLastConsumption(cpf: string, restaurantId: string): Promise<LastConsumption> {
        const raw = await this.getRequired<UnknownRecord>('ultimo-consumo', cpf, restaurantId);
        return {
            hasPendingFeedback: raw.hasPendingFeedback === true,
            consumptionId: this.readNullableString(raw, 'consumptionId'),
            meal: this.readNullableString(raw, 'meal')
        };
    }

    async listRestaurants(cpf: string): Promise<Restaurant[]> {
        const raw = await this.getRequired<unknown>('restaurantes', cpf);
        return Array.isArray(raw) ? raw.map((item) => {
            const record = (item && typeof item === 'object' ? item : {}) as UnknownRecord;
            return {
                id: this.readString(record, 'id'),
                name: this.readString(record, 'name'),
                city: this.readString(record, 'city')
            };
        }) : [];
    }

    async clearUserCache(cpf: string): Promise<number> {
        const pattern = getRuDigitalUserCachePattern(cpf);
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

    private readMealBalance(raw: UnknownRecord, key: string): MealBalance {
        const meal = (raw[key] && typeof raw[key] === 'object' ? raw[key] : {}) as UnknownRecord;
        return {
            mealPrice: this.readNumber(meal, 'mealPrice'),
            currentBalance: this.readNumber(meal, 'currentBalance'),
            availableForPurchase: this.readNumber(meal, 'availableForPurchase')
        };
    }

    private async getRequired<T>(resource: Parameters<typeof getRuDigitalCacheKey>[0], cpf: string, extra?: string): Promise<T> {
        const raw = await this.redis.get(getRuDigitalCacheKey(resource, cpf, extra));
        if (!raw) {
            throw new RuDigitalResourceNotFoundException(this.toDomainResource(resource));
        }

        return decryptCachePayload<T>(raw);
    }

    private toDomainResource(resource: Parameters<typeof getRuDigitalCacheKey>[0]): 'student' | 'balance' | 'daily-menu' | 'default-restaurant' | 'last-consumption' | 'restaurant-list' {
        const map = {
            discente: 'student',
            saldo: 'balance',
            cardapio: 'daily-menu',
            restaurante: 'default-restaurant',
            'ultimo-consumo': 'last-consumption',
            restaurantes: 'restaurant-list'
        } as const;
        return map[resource];
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

    private readStringArray(record: UnknownRecord, key: string): string[] {
        const value = record[key];
        return Array.isArray(value) ? value.map((item) => String(item)) : [];
    }

    private readNumber(record: UnknownRecord, key: string): number {
        const value = record[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }
}

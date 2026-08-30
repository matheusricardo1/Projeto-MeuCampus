import type { Student } from '@ru-digital/domain/entities/student.entity';
import type { Balance } from '@ru-digital/domain/entities/balance.entity';
import type { DailyMenu } from '@ru-digital/domain/entities/daily-menu.entity';
import type { Restaurant } from '@ru-digital/domain/entities/restaurant.entity';
import type { LastConsumption } from '@ru-digital/domain/entities/last-consumption.entity';

/**
 * Reads the raw results the worker already scraped and cached. Written by
 * the worker only — this is a read side, like AcademicDataRepository.
 */
export abstract class RuDigitalDataRepository {
    abstract getStudent(cpf: string): Promise<Student>;
    abstract getBalance(cpf: string): Promise<Balance>;
    abstract getDailyMenu(cpf: string, date: string): Promise<DailyMenu>;
    abstract getDefaultRestaurant(cpf: string): Promise<Restaurant>;
    abstract getLastConsumption(cpf: string, restaurantId: string): Promise<LastConsumption>;
    abstract listRestaurants(cpf: string): Promise<Restaurant[]>;
    abstract clearUserCache(cpf: string): Promise<number>;
}

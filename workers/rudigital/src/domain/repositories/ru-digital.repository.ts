import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';
import type { Student } from '@/domain/entities/student';
import type { Balance } from '@/domain/entities/balance';
import type { DailyMenu } from '@/domain/entities/daily-menu';
import type { Restaurant } from '@/domain/entities/restaurant';
import type { LastConsumption } from '@/domain/entities/last-consumption';

export interface RuDigitalRepository {
    logout(credentials: RuDigitalCredentials): Promise<void>;
    getStudent(credentials: RuDigitalCredentials): Promise<Student>;
    getBalance(credentials: RuDigitalCredentials): Promise<Balance>;
    getDailyMenu(credentials: RuDigitalCredentials, date: string): Promise<DailyMenu>;
    getDefaultRestaurant(credentials: RuDigitalCredentials): Promise<Restaurant>;
    getLastConsumption(credentials: RuDigitalCredentials, restaurantId: string): Promise<LastConsumption>;
    listRestaurants(credentials: RuDigitalCredentials): Promise<Restaurant[]>;
    /** Returns the updated session (now carrying the chosen restaurant) to persist. */
    selectDefaultRestaurant(credentials: RuDigitalCredentials, restaurantId: string): Promise<Record<string, unknown>>;
}

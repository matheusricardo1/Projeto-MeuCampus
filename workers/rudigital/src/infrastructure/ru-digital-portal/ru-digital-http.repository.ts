import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';
import type { Student } from '@/domain/entities/student';
import type { Balance, MealBalance } from '@/domain/entities/balance';
import type { DailyMenu } from '@/domain/entities/daily-menu';
import type { Restaurant } from '@/domain/entities/restaurant';
import type { LastConsumption } from '@/domain/entities/last-consumption';
import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import { RuDigitalAuthService } from '@/infrastructure/ru-digital-portal/ru-digital-auth-service';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';

const DASHBOARD_ROUTE = '/home/dashboard';

type UnknownRecord = Record<string, unknown>;

/**
 * Implements the domain repository against RU Digital's real wire shapes
 * (Portuguese field names, e.g. `desjejum`/`almoco`/`jantar`) and maps them
 * into the English domain entities — the raw external contract never leaks
 * past this file.
 */
export class RuDigitalHttpRepository implements RuDigitalRepository {
    constructor(private readonly authService: RuDigitalAuthService) {}

    async logout(credentials: RuDigitalCredentials): Promise<void> {
        await this.authService.logout(credentials);
    }

    async getStudent(credentials: RuDigitalCredentials): Promise<Student> {
        const client = this.authService.getAuthenticatedClient(credentials);
        logger.info('Fetching RU Digital student data...');

        const raw = await client.callAction<UnknownRecord>(DASHBOARD_ROUTE, 'getDiscenteAction', [
            { client: '$T', queryKey: ['discente', 'session'], meta: '$undefined', signal: '$T' }
        ]);

        return {
            studentId: this.readNumber(raw, 'idAluno'),
            courseEnrollmentId: this.readNumber(raw, 'idCursoAluno'),
            cpf: this.readString(raw, 'cpf'),
            fullName: this.readString(raw, 'idPessoa'),
            enrollmentNumber: this.readString(raw, 'matrAluno'),
            courseCode: this.readString(raw, 'codCurso'),
            courseName: this.readString(raw, 'nomeCursoDiploma')
        };
    }

    async getBalance(credentials: RuDigitalCredentials): Promise<Balance> {
        const client = this.authService.getAuthenticatedClient(credentials);
        logger.info('Fetching RU Digital balance...');

        const raw = await client.callAction<UnknownRecord>(DASHBOARD_ROUTE, 'getSaldoAction', [
            { client: '$T', queryKey: ['saldo', 'session'], meta: '$undefined', signal: '$T' }
        ]);

        return {
            breakfast: this.readMealBalance(raw, 'desjejum'),
            lunch: this.readMealBalance(raw, 'almoco'),
            dinner: this.readMealBalance(raw, 'jantar')
        };
    }

    async getDailyMenu(credentials: RuDigitalCredentials, date: string): Promise<DailyMenu> {
        const client = this.authService.getAuthenticatedClient(credentials);
        logger.info('Fetching RU Digital daily menu...', { date });

        const raw = await client.callAction<UnknownRecord>(DASHBOARD_ROUTE, 'getCardapioAction', [date]);

        return {
            date,
            restaurantId: this.readString(raw, 'restaurante'),
            mealId: this.readString(raw, 'refeicaoId'),
            items: this.readStringArray(raw, 'items')
        };
    }

    async getDefaultRestaurant(credentials: RuDigitalCredentials): Promise<Restaurant> {
        const client = this.authService.getAuthenticatedClient(credentials);
        logger.info('Fetching RU Digital default restaurant...');

        const raw = await client.callAction<UnknownRecord>(DASHBOARD_ROUTE, 'getRestauranteDefaultAction', [
            { client: '$T', queryKey: ['restaurante', 'session'], meta: '$undefined', signal: '$T' }
        ]);

        return {
            id: this.readString(raw, 'id'),
            name: this.readString(raw, 'nome'),
            city: this.readString(raw, 'cidade')
        };
    }

    async getLastConsumption(credentials: RuDigitalCredentials, restaurantId: string): Promise<LastConsumption> {
        const client = this.authService.getAuthenticatedClient(credentials);
        logger.info('Fetching RU Digital last consumption...', { restaurantId });

        const raw = await client.callAction<UnknownRecord>(DASHBOARD_ROUTE, 'getUltimoConsumoAction', [restaurantId]);

        return {
            hasPendingFeedback: this.readBoolean(raw, 'hasPendingFeedback'),
            consumptionId: this.readNullableString(raw, 'consumoId'),
            meal: this.readNullableString(raw, 'refeicao')
        };
    }

    async listRestaurants(credentials: RuDigitalCredentials): Promise<Restaurant[]> {
        const client = this.authService.getAuthenticatedClient(credentials);
        logger.info('Fetching the RU Digital restaurant list...');

        const rawList = await client.listRestaurants();
        return rawList.map((raw) => ({
            id: String(raw.id ?? ''),
            name: String(raw.nome ?? ''),
            city: String(raw.cidade ?? '')
        }));
    }

    async selectDefaultRestaurant(credentials: RuDigitalCredentials, restaurantId: string): Promise<Record<string, unknown>> {
        const client = this.authService.getAuthenticatedClient(credentials);
        logger.info('Selecting the RU Digital default restaurant...', { restaurantId });

        await client.selectDefaultRestaurant(restaurantId);
        return { ...client.exportSession() };
    }

    private readMealBalance(raw: UnknownRecord, key: string): MealBalance {
        const meal = (raw[key] && typeof raw[key] === 'object' ? raw[key] : {}) as UnknownRecord;
        return {
            mealPrice: this.readNumber(meal, 'valorRefeicao'),
            currentBalance: this.readNumber(meal, 'saldoAtual'),
            availableForPurchase: this.readNumber(meal, 'disponivelParaCompra')
        };
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
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const parsed = Number.parseFloat(value.replace(',', '.'));
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    }

    private readBoolean(record: UnknownRecord, key: string): boolean {
        return record[key] === true;
    }
}

import type { RuDigitalScrapeJobData, RuDigitalScrapeJobName } from '@/application/ports/ru-digital-scrape-job';
import { LoginRuDigitalSessionUseCase } from '@/application/use-cases/login-ru-digital-session.usecase';
import { LogoutRuDigitalSessionUseCase } from '@/application/use-cases/logout-ru-digital-session.usecase';
import { GetStudentUseCase } from '@/application/use-cases/get-student.usecase';
import { GetBalanceUseCase } from '@/application/use-cases/get-balance.usecase';
import { GetDailyMenuUseCase } from '@/application/use-cases/get-daily-menu.usecase';
import { GetDefaultRestaurantUseCase } from '@/application/use-cases/get-default-restaurant.usecase';
import { GetLastConsumptionUseCase } from '@/application/use-cases/get-last-consumption.usecase';
import { ListRestaurantsUseCase } from '@/application/use-cases/list-restaurants.usecase';
import { SelectDefaultRestaurantUseCase } from '@/application/use-cases/select-default-restaurant.usecase';
import { ReportRuDigitalScrapeFailureUseCase } from '@/application/use-cases/report-ru-digital-scrape-failure.usecase';

type AuthenticatedScrapeJobData = Extract<RuDigitalScrapeJobData, { credentials: unknown }>;

/** Thin router from a BullMQ job name to the use case that performs it. */
export class ProcessRuDigitalScrapeJobUseCase {
    constructor(
        private readonly login: LoginRuDigitalSessionUseCase,
        private readonly logout: LogoutRuDigitalSessionUseCase,
        private readonly getStudent: GetStudentUseCase,
        private readonly getBalance: GetBalanceUseCase,
        private readonly getDailyMenu: GetDailyMenuUseCase,
        private readonly getDefaultRestaurant: GetDefaultRestaurantUseCase,
        private readonly getLastConsumption: GetLastConsumptionUseCase,
        private readonly listRestaurants: ListRestaurantsUseCase,
        private readonly selectDefaultRestaurant: SelectDefaultRestaurantUseCase,
        private readonly reportFailure: ReportRuDigitalScrapeFailureUseCase
    ) {}

    async execute(name: RuDigitalScrapeJobName, data: RuDigitalScrapeJobData, jobId?: string): Promise<unknown> {
        if (name === 'login') {
            const { cpf, password } = data as { cpf: string; password: string };
            return this.login.execute(cpf, password, jobId);
        }

        const authenticatedData = data as AuthenticatedScrapeJobData;

        switch (name) {
            case 'logout':
                return this.logout.execute(authenticatedData.credentials);
            case 'student':
                return this.getStudent.execute(authenticatedData.credentials);
            case 'balance':
                return this.getBalance.execute(authenticatedData.credentials);
            case 'daily-menu': {
                const { date } = authenticatedData as { date: string };
                return this.getDailyMenu.execute(authenticatedData.credentials, date);
            }
            case 'default-restaurant':
                return this.getDefaultRestaurant.execute(authenticatedData.credentials);
            case 'last-consumption': {
                const { restaurantId } = authenticatedData as { restaurantId: string };
                return this.getLastConsumption.execute(authenticatedData.credentials, restaurantId);
            }
            case 'restaurant-list':
                return this.listRestaurants.execute(authenticatedData.credentials);
            case 'select-restaurant': {
                const { restaurantId } = authenticatedData as { restaurantId: string };
                return this.selectDefaultRestaurant.execute(authenticatedData.credentials, restaurantId);
            }
            default:
                throw new Error(`Unsupported RU Digital scraping job: ${name}`);
        }
    }

    async handleFailure(name: string, data: RuDigitalScrapeJobData, error: Error): Promise<boolean> {
        return this.reportFailure.execute(name, data, error);
    }
}

import { describe, expect, it, vi } from 'vitest';
import { ProcessRuDigitalScrapeJobUseCase } from '@/application/use-cases/process-ru-digital-scrape-job.usecase';

const CREDENTIALS = { cpf: '06124555212', token: 'jwt' };

function buildUseCases() {
    return {
        login: { execute: vi.fn().mockResolvedValue({ session: {} }) },
        logout: { execute: vi.fn().mockResolvedValue({ cacheDeletedKeys: 0, externalLogout: 'ok' }) },
        getStudent: { execute: vi.fn().mockResolvedValue({}) },
        getBalance: { execute: vi.fn().mockResolvedValue({}) },
        getDailyMenu: { execute: vi.fn().mockResolvedValue({}) },
        getDefaultRestaurant: { execute: vi.fn().mockResolvedValue({}) },
        getLastConsumption: { execute: vi.fn().mockResolvedValue({}) },
        listRestaurants: { execute: vi.fn().mockResolvedValue([]) },
        selectDefaultRestaurant: { execute: vi.fn().mockResolvedValue({ session: {} }) },
        reportFailure: { execute: vi.fn().mockResolvedValue(true) }
    };
}

function buildRouter(useCases: ReturnType<typeof buildUseCases>) {
    return new ProcessRuDigitalScrapeJobUseCase(
        useCases.login as any,
        useCases.logout as any,
        useCases.getStudent as any,
        useCases.getBalance as any,
        useCases.getDailyMenu as any,
        useCases.getDefaultRestaurant as any,
        useCases.getLastConsumption as any,
        useCases.listRestaurants as any,
        useCases.selectDefaultRestaurant as any,
        useCases.reportFailure as any
    );
}

describe('ProcessRuDigitalScrapeJobUseCase', () => {
    it('routes "login" with the jobId, using cpf/password directly (no credentials wrapper)', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);

        await router.execute('login', { cpf: CREDENTIALS.cpf, password: 'secret' }, 'job-1');

        expect(useCases.login.execute).toHaveBeenCalledWith(CREDENTIALS.cpf, 'secret', 'job-1');
    });

    it('routes "logout" with credentials', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);

        await router.execute('logout', { credentials: CREDENTIALS });

        expect(useCases.logout.execute).toHaveBeenCalledWith(CREDENTIALS);
    });

    it('routes "student" with credentials', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);

        await router.execute('student', { credentials: CREDENTIALS });

        expect(useCases.getStudent.execute).toHaveBeenCalledWith(CREDENTIALS);
    });

    it('routes "balance" with credentials', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);

        await router.execute('balance', { credentials: CREDENTIALS });

        expect(useCases.getBalance.execute).toHaveBeenCalledWith(CREDENTIALS);
    });

    it('routes "daily-menu" with credentials and date', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);

        await router.execute('daily-menu', { credentials: CREDENTIALS, date: '2026-08-28' } as any);

        expect(useCases.getDailyMenu.execute).toHaveBeenCalledWith(CREDENTIALS, '2026-08-28');
    });

    it('routes "default-restaurant" with credentials', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);

        await router.execute('default-restaurant', { credentials: CREDENTIALS });

        expect(useCases.getDefaultRestaurant.execute).toHaveBeenCalledWith(CREDENTIALS);
    });

    it('routes "last-consumption" with credentials and restaurantId', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);

        await router.execute('last-consumption', { credentials: CREDENTIALS, restaurantId: 'MAO' });

        expect(useCases.getLastConsumption.execute).toHaveBeenCalledWith(CREDENTIALS, 'MAO');
    });

    it('routes "restaurant-list" with credentials', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);

        await router.execute('restaurant-list', { credentials: CREDENTIALS });

        expect(useCases.listRestaurants.execute).toHaveBeenCalledWith(CREDENTIALS);
    });

    it('routes "select-restaurant" with credentials and restaurantId', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);

        await router.execute('select-restaurant', { credentials: CREDENTIALS, restaurantId: 'MAO' });

        expect(useCases.selectDefaultRestaurant.execute).toHaveBeenCalledWith(CREDENTIALS, 'MAO');
    });

    it('throws for an unsupported job name', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);

        await expect(router.execute('unknown-job' as any, { credentials: CREDENTIALS })).rejects.toThrow('Unsupported RU Digital scraping job: unknown-job');
    });

    it('handleFailure delegates to ReportRuDigitalScrapeFailureUseCase', async () => {
        const useCases = buildUseCases();
        const router = buildRouter(useCases);
        const error = new Error('boom');

        const result = await router.handleFailure('balance', { credentials: CREDENTIALS }, error);

        expect(useCases.reportFailure.execute).toHaveBeenCalledWith('balance', { credentials: CREDENTIALS }, error);
        expect(result).toBe(true);
    });
});

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { RuDigitalController } from '@ru-digital/presentation/http/ru-digital.controller';

const CREDENTIALS = { cpf: '06124555212' };

function buildResponse(): Response {
    return {
        locals: {},
        status: vi.fn().mockReturnThis()
    } as unknown as Response;
}

function buildController(overrides: Partial<Record<string, any>> = {}) {
    const useCases = {
        loginUseCase: { execute: vi.fn() },
        logoutUseCase: { execute: vi.fn() },
        getStudentUseCase: { execute: vi.fn() },
        getBalanceUseCase: { execute: vi.fn() },
        getDailyMenuUseCase: { execute: vi.fn() },
        getDefaultRestaurantUseCase: { execute: vi.fn() },
        getLastConsumptionUseCase: { execute: vi.fn() },
        listRestaurantsUseCase: { execute: vi.fn() },
        selectRestaurantUseCase: { execute: vi.fn() },
        ...overrides
    };

    const controller = new RuDigitalController(
        useCases.loginUseCase as any,
        useCases.logoutUseCase as any,
        useCases.getStudentUseCase as any,
        useCases.getBalanceUseCase as any,
        useCases.getDailyMenuUseCase as any,
        useCases.getDefaultRestaurantUseCase as any,
        useCases.getLastConsumptionUseCase as any,
        useCases.listRestaurantsUseCase as any,
        useCases.selectRestaurantUseCase as any
    );

    return { controller, ...useCases };
}

describe('RuDigitalController.health', () => {
    it('returns a static ok status', () => {
        const { controller } = buildController();
        expect(controller.health()).toEqual({ status: 'ok', module: 'ru-digital' });
    });
});

describe('RuDigitalController.login', () => {
    it('delegates to LoginRuDigitalUseCase and returns the access token', async () => {
        const { controller, loginUseCase } = buildController();
        (loginUseCase.execute as any).mockResolvedValue({ accessToken: 'jwt' });

        const result = await controller.login({ cpf: '06124555212', password: 'secret' });

        expect(loginUseCase.execute).toHaveBeenCalledWith({ cpf: '06124555212', password: 'secret' });
        expect(result).toEqual({ accessToken: 'jwt' });
    });

    it('rejects a request missing cpf or password before calling the use case', async () => {
        const { controller, loginUseCase } = buildController();

        await expect(controller.login({ cpf: '', password: 'secret' })).rejects.toThrow(BadRequestException);
        expect(loginUseCase.execute).not.toHaveBeenCalled();
    });

    it('wraps a login failure (e.g. bad credentials) as Unauthorized', async () => {
        const { controller, loginUseCase } = buildController();
        (loginUseCase.execute as any).mockRejectedValue(new Error('CPF ou senha invalidos.'));

        await expect(controller.login({ cpf: '06124555212', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });
});

describe('RuDigitalController.logout', () => {
    it('calls LogoutRuDigitalUseCase and returns ok', async () => {
        const { controller, logoutUseCase } = buildController();
        (logoutUseCase.execute as any).mockResolvedValue(undefined);

        const result = await controller.logout(CREDENTIALS);

        expect(logoutUseCase.execute).toHaveBeenCalledWith(CREDENTIALS);
        expect(result).toEqual({ status: 'ok' });
    });
});

describe('RuDigitalController resource endpoints', () => {
    it('getStudent returns 200 for a ready resource', async () => {
        const { controller, getStudentUseCase } = buildController();
        const student = { studentId: 1, fullName: 'MATHEUS' };
        (getStudentUseCase.execute as any).mockResolvedValue(student);
        const response = buildResponse();

        const result = await controller.getStudent(CREDENTIALS, response);

        expect(result).toBe(student);
        expect(response.status).not.toHaveBeenCalled();
    });

    it('getStudent returns 202 for a pending resource', async () => {
        const { controller, getStudentUseCase } = buildController();
        (getStudentUseCase.execute as any).mockResolvedValue({ status: 'pending', resource: 'student' });
        const response = buildResponse();

        const result = await controller.getStudent(CREDENTIALS, response);

        expect(result).toEqual({ status: 'pending', resource: 'student' });
        expect(response.status).toHaveBeenCalledWith(202);
    });

    it('getBalance delegates to GetBalanceUseCase', async () => {
        const { controller, getBalanceUseCase } = buildController();
        const balance = { breakfast: {}, lunch: {}, dinner: {} };
        (getBalanceUseCase.execute as any).mockResolvedValue(balance);

        const result = await controller.getBalance(CREDENTIALS, buildResponse());

        expect(getBalanceUseCase.execute).toHaveBeenCalledWith(CREDENTIALS);
        expect(result).toBe(balance);
    });

    it('getDailyMenu defaults to today when no date query param is given', async () => {
        const { controller, getDailyMenuUseCase } = buildController();
        (getDailyMenuUseCase.execute as any).mockResolvedValue({ date: 'today', items: [] });
        const today = new Date().toISOString().slice(0, 10);

        await controller.getDailyMenu(CREDENTIALS, undefined, buildResponse());

        expect(getDailyMenuUseCase.execute).toHaveBeenCalledWith(CREDENTIALS, today);
    });

    it('getDailyMenu forwards the given date query param', async () => {
        const { controller, getDailyMenuUseCase } = buildController();
        (getDailyMenuUseCase.execute as any).mockResolvedValue({ date: '2026-08-28', items: [] });

        await controller.getDailyMenu(CREDENTIALS, '2026-08-28', buildResponse());

        expect(getDailyMenuUseCase.execute).toHaveBeenCalledWith(CREDENTIALS, '2026-08-28');
    });

    it('getDefaultRestaurant delegates to GetDefaultRestaurantUseCase', async () => {
        const { controller, getDefaultRestaurantUseCase } = buildController();
        const restaurant = { id: 'MAO', name: 'Manaus - Campus Coroado', city: 'Manaus - Campus Coroado' };
        (getDefaultRestaurantUseCase.execute as any).mockResolvedValue(restaurant);

        const result = await controller.getDefaultRestaurant(CREDENTIALS, buildResponse());

        expect(result).toBe(restaurant);
    });

    it('getLastConsumption requires a restaurantId query param', async () => {
        const { controller, getLastConsumptionUseCase } = buildController();

        await expect(controller.getLastConsumption(CREDENTIALS, undefined, buildResponse())).rejects.toThrow(BadRequestException);
        expect(getLastConsumptionUseCase.execute).not.toHaveBeenCalled();
    });

    it('getLastConsumption forwards the restaurantId query param', async () => {
        const { controller, getLastConsumptionUseCase } = buildController();
        (getLastConsumptionUseCase.execute as any).mockResolvedValue({ hasPendingFeedback: false, consumptionId: null, meal: null });

        await controller.getLastConsumption(CREDENTIALS, 'MAO', buildResponse());

        expect(getLastConsumptionUseCase.execute).toHaveBeenCalledWith(CREDENTIALS, 'MAO');
    });

    it('listRestaurants delegates to ListRestaurantsUseCase', async () => {
        const { controller, listRestaurantsUseCase } = buildController();
        const restaurants = [{ id: 'MAO', name: 'Manaus - Campus Coroado', city: 'Manaus - Campus Coroado' }];
        (listRestaurantsUseCase.execute as any).mockResolvedValue(restaurants);

        const result = await controller.listRestaurants(CREDENTIALS, buildResponse());

        expect(result).toBe(restaurants);
    });
});

describe('RuDigitalController.selectRestaurant', () => {
    it('requires a restaurantId in the body', async () => {
        const { controller, selectRestaurantUseCase } = buildController();

        await expect(controller.selectRestaurant(CREDENTIALS, {})).rejects.toThrow(BadRequestException);
        expect(selectRestaurantUseCase.execute).not.toHaveBeenCalled();
    });

    it('delegates to SelectRestaurantUseCase and returns the new access token', async () => {
        const { controller, selectRestaurantUseCase } = buildController();
        (selectRestaurantUseCase.execute as any).mockResolvedValue({ accessToken: 'new-jwt' });

        const result = await controller.selectRestaurant(CREDENTIALS, { restaurantId: 'MAO' });

        expect(selectRestaurantUseCase.execute).toHaveBeenCalledWith(CREDENTIALS, 'MAO');
        expect(result).toEqual({ accessToken: 'new-jwt' });
    });
});

import { Body, Controller, Get, HttpCode, Post, Query, Res, UseGuards, BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { LoginRuDigitalUseCase } from '@ru-digital/application/use-cases/login-ru-digital.usecase';
import { LogoutRuDigitalUseCase } from '@ru-digital/application/use-cases/logout-ru-digital.usecase';
import { GetStudentUseCase } from '@ru-digital/application/use-cases/get-student.usecase';
import { GetBalanceUseCase } from '@ru-digital/application/use-cases/get-balance.usecase';
import { GetDailyMenuUseCase } from '@ru-digital/application/use-cases/get-daily-menu.usecase';
import { GetDefaultRestaurantUseCase } from '@ru-digital/application/use-cases/get-default-restaurant.usecase';
import { GetLastConsumptionUseCase } from '@ru-digital/application/use-cases/get-last-consumption.usecase';
import { ListRestaurantsUseCase } from '@ru-digital/application/use-cases/list-restaurants.usecase';
import { SelectRestaurantUseCase } from '@ru-digital/application/use-cases/select-restaurant.usecase';
import { RuDigitalAuthGuard } from '@ru-digital/presentation/http/guards/ru-digital-auth.guard';
import { CurrentRuDigitalCredentials } from '@ru-digital/presentation/http/decorators/current-ru-digital-credentials.decorator';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';
import type { RuDigitalResource } from '@ru-digital/domain/value-objects/ru-digital-resource.value-object';
import { isPendingScrapeJob } from '@ru-digital/application/services/pending-scrape-job';

@Controller('ru-digital')
export class RuDigitalController {
    constructor(
        private readonly loginUseCase: LoginRuDigitalUseCase,
        private readonly logoutUseCase: LogoutRuDigitalUseCase,
        private readonly getStudentUseCase: GetStudentUseCase,
        private readonly getBalanceUseCase: GetBalanceUseCase,
        private readonly getDailyMenuUseCase: GetDailyMenuUseCase,
        private readonly getDefaultRestaurantUseCase: GetDefaultRestaurantUseCase,
        private readonly getLastConsumptionUseCase: GetLastConsumptionUseCase,
        private readonly listRestaurantsUseCase: ListRestaurantsUseCase,
        private readonly selectRestaurantUseCase: SelectRestaurantUseCase
    ) {}

    @Get('health')
    health() {
        return { status: 'ok', module: 'ru-digital' };
    }

    @Post('login')
    @HttpCode(200)
    async login(@Body() body: { cpf?: string; password?: string }) {
        if (!body.cpf || !body.password) {
            throw new BadRequestException('Missing credentials');
        }

        try {
            return await this.loginUseCase.execute({ cpf: body.cpf, password: body.password });
        } catch (error) {
            throw new UnauthorizedException(error instanceof Error ? error.message : 'RU Digital login failed.');
        }
    }

    @Post('logout')
    @HttpCode(200)
    @UseGuards(RuDigitalAuthGuard)
    async logout(@CurrentRuDigitalCredentials() credentials: RuDigitalCredentials) {
        await this.logoutUseCase.execute(credentials);
        return { status: 'ok' };
    }

    @Get('student')
    @UseGuards(RuDigitalAuthGuard)
    async getStudent(@CurrentRuDigitalCredentials() credentials: RuDigitalCredentials, @Res({ passthrough: true }) response: Response) {
        return this.respondWithResourceStatus(response, 'student', await this.getStudentUseCase.execute(credentials));
    }

    @Get('balance')
    @UseGuards(RuDigitalAuthGuard)
    async getBalance(@CurrentRuDigitalCredentials() credentials: RuDigitalCredentials, @Res({ passthrough: true }) response: Response) {
        return this.respondWithResourceStatus(response, 'balance', await this.getBalanceUseCase.execute(credentials));
    }

    @Get('daily-menu')
    @UseGuards(RuDigitalAuthGuard)
    async getDailyMenu(
        @CurrentRuDigitalCredentials() credentials: RuDigitalCredentials,
        @Query('date') date: string | undefined,
        @Res({ passthrough: true }) response: Response
    ) {
        const resolvedDate = date || new Date().toISOString().slice(0, 10);
        return this.respondWithResourceStatus(response, 'daily-menu', await this.getDailyMenuUseCase.execute(credentials, resolvedDate));
    }

    @Get('restaurant')
    @UseGuards(RuDigitalAuthGuard)
    async getDefaultRestaurant(@CurrentRuDigitalCredentials() credentials: RuDigitalCredentials, @Res({ passthrough: true }) response: Response) {
        return this.respondWithResourceStatus(response, 'default-restaurant', await this.getDefaultRestaurantUseCase.execute(credentials));
    }

    @Get('last-consumption')
    @UseGuards(RuDigitalAuthGuard)
    async getLastConsumption(
        @CurrentRuDigitalCredentials() credentials: RuDigitalCredentials,
        @Query('restaurantId') restaurantId: string | undefined,
        @Res({ passthrough: true }) response: Response
    ) {
        if (!restaurantId) {
            throw new BadRequestException('restaurantId query parameter is required');
        }

        return this.respondWithResourceStatus(response, 'last-consumption', await this.getLastConsumptionUseCase.execute(credentials, restaurantId));
    }

    @Get('restaurants')
    @UseGuards(RuDigitalAuthGuard)
    async listRestaurants(@CurrentRuDigitalCredentials() credentials: RuDigitalCredentials, @Res({ passthrough: true }) response: Response) {
        return this.respondWithResourceStatus(response, 'restaurant-list', await this.listRestaurantsUseCase.execute(credentials));
    }

    @Post('restaurant/select')
    @HttpCode(200)
    @UseGuards(RuDigitalAuthGuard)
    async selectRestaurant(@CurrentRuDigitalCredentials() credentials: RuDigitalCredentials, @Body() body: { restaurantId?: string }) {
        if (!body.restaurantId) {
            throw new BadRequestException('Missing restaurantId');
        }

        return this.selectRestaurantUseCase.execute(credentials, body.restaurantId);
    }

    private respondWithResourceStatus<T>(response: Response, resource: RuDigitalResource, result: T): T {
        if (isPendingScrapeJob(result)) {
            response.status(202);
            return result;
        }

        return result;
    }
}

import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { GetGradesUseCase } from '@ecampus/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@ecampus/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@ecampus/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@ecampus/application/use-cases/get-schedule.usecase';
import { GetStudentProfileUseCase } from '@ecampus/application/use-cases/get-student-profile.usecase';
import { LoginEcampusUseCase } from '@ecampus/application/use-cases/login-ecampus.usecase';
import { LogoutEcampusUseCase } from '@ecampus/application/use-cases/logout-ecampus.usecase';
import { AuthenticationError } from '@ecampus/domain/errors/authentication.error';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import { CurrentEcampusCredentials } from '@ecampus/presentation/http/decorators/current-ecampus-credentials.decorator';
import { LoginEcampusRequest } from '@ecampus/presentation/http/dto/login-ecampus.request';
import { EcampusJwtGuard } from '@ecampus/presentation/http/guards/ecampus-jwt.guard';

@Controller('ecampus')
export class EcampusController {
    constructor(
        private readonly loginEcampusUseCase: LoginEcampusUseCase,
        private readonly getGradesUseCase: GetGradesUseCase,
        private readonly getLessonPlanUseCase: GetLessonPlanUseCase,
        private readonly getLessonPlanSubjectsUseCase: GetLessonPlanSubjectsUseCase,
        private readonly getScheduleUseCase: GetScheduleUseCase,
        private readonly getStudentProfileUseCase: GetStudentProfileUseCase,
        private readonly logoutEcampusUseCase: LogoutEcampusUseCase
    ) {}

    @Get('health')
    health() {
        return {
            status: 'ok',
            module: 'ecampus'
        };
    }

    @Post('login')
    async login(@Body() body: LoginEcampusRequest) {
        const user = this.parseCpf(body.user);
        const password = this.parsePassword(body.password);

        try {
            return await this.loginEcampusUseCase.execute({
                user,
                password
            });
        } catch (error) {
            if (error instanceof AuthenticationError) {
                throw new UnauthorizedException("Invalid eCampus credentials.");
            }

            throw error;
        }
    }

    @Post('logout')
    @HttpCode(200)
    @UseGuards(EcampusJwtGuard)
    async logout(@CurrentEcampusCredentials() credentials: EcampusCredentials) {
        await this.logoutEcampusUseCase.execute(credentials);

        return {
            status: 'ok'
        };
    }

    @Get('profile')
    @UseGuards(EcampusJwtGuard)
    getStudentProfile(@CurrentEcampusCredentials() credentials: EcampusCredentials) {
        return this.getStudentProfileUseCase.execute(credentials);
    }

    @Get('grades')
    @UseGuards(EcampusJwtGuard)
    getGrades(
        @CurrentEcampusCredentials() credentials: EcampusCredentials,
        @Query('year') year?: string,
        @Query('period') period?: string
    ) {
        const normalizedYear = this.parseYear(year);
        const normalizedPeriod = this.parsePeriod(period);

        return this.getGradesUseCase.execute(credentials, normalizedYear, normalizedPeriod);
    }

    @Get('schedule')
    @UseGuards(EcampusJwtGuard)
    getSchedule(@CurrentEcampusCredentials() credentials: EcampusCredentials) {
        return this.getScheduleUseCase.execute(credentials);
    }

    @Get('lesson-plans/:planId')
    @UseGuards(EcampusJwtGuard)
    getLessonPlan(
        @CurrentEcampusCredentials() credentials: EcampusCredentials,
        @Param('planId') planId: string
    ) {
        return this.getLessonPlanUseCase.execute(credentials, this.parsePlanId(planId));
    }

    @Get('lesson-plans')
    @UseGuards(EcampusJwtGuard)
    getLessonPlanSubjects(@CurrentEcampusCredentials() credentials: EcampusCredentials) {
        return this.getLessonPlanSubjectsUseCase.execute(credentials);
    }

    private parseCpf(value?: string): string {
        const digits = value?.replace(/\D/g, '') || '';
        if (!/^\d{11}$/.test(digits)) {
            throw new BadRequestException("Field 'user' must be a valid CPF with 11 digits.");
        }

        return digits;
    }

    private parsePassword(value?: string): string {
        if (typeof value !== 'string' || value.length < 1 || value.length > 128 || /[\u0000-\u001F\u007F]/.test(value)) {
            throw new BadRequestException("Field 'password' is invalid.");
        }

        return value;
    }

    private parseYear(value?: string): string {
        const year = value?.trim() || '';
        if (!/^\d{4}$/.test(year)) {
            throw new BadRequestException("Query param 'year' must have 4 digits.");
        }

        const numericYear = Number(year);
        const nextYear = new Date().getFullYear() + 1;
        if (numericYear < 2000 || numericYear > nextYear) {
            throw new BadRequestException("Query param 'year' is outside the accepted range.");
        }

        return year;
    }

    private parsePeriod(value?: string): string {
        const period = value?.trim().toLowerCase() || '';
        const acceptedPeriods = new Set(['1', '1o', '201', '2', '2o', '202', 'ferias1', 'ferias-1', '203', 'ferias2', 'ferias-2', '204', 'especial', '5', '401']);

        if (!acceptedPeriods.has(period)) {
            throw new BadRequestException("Query param 'period' is invalid.");
        }

        return period;
    }

    private parsePlanId(value: string): string {
        const planId = value.trim();
        if (!/^\d{1,20}$/.test(planId)) {
            throw new BadRequestException("Route param 'planId' is invalid.");
        }

        return planId;
    }
}

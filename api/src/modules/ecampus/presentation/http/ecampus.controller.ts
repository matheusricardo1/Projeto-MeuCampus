import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GetGradesUseCase } from '@ecampus/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@ecampus/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@ecampus/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@ecampus/application/use-cases/get-schedule.usecase';
import { GetStudentProfileUseCase } from '@ecampus/application/use-cases/get-student-profile.usecase';
import { LoginEcampusUseCase } from '@ecampus/application/use-cases/login-ecampus.usecase';
import { LogoutEcampusUseCase } from '@ecampus/application/use-cases/logout-ecampus.usecase';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import { CurrentEcampusCredentials } from '@ecampus/presentation/http/decorators/current-ecampus-credentials.decorator';
import { GetGradesQuery } from '@ecampus/presentation/http/dto/get-grades.query';
import { GetLessonPlanParams } from '@ecampus/presentation/http/dto/get-lesson-plan.params';
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
        return this.loginEcampusUseCase.execute(new LoginEcampusRequest(body?.user, body?.password).toCredentialsInput());
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
        const input = new GetGradesQuery(year, period).toUseCaseInput();

        return this.getGradesUseCase.execute(credentials, input.year, input.period);
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
        return this.getLessonPlanUseCase.execute(credentials, new GetLessonPlanParams(planId).toUseCaseInput().planId);
    }

    @Get('lesson-plans')
    @UseGuards(EcampusJwtGuard)
    getLessonPlanSubjects(@CurrentEcampusCredentials() credentials: EcampusCredentials) {
        return this.getLessonPlanSubjectsUseCase.execute(credentials);
    }
}

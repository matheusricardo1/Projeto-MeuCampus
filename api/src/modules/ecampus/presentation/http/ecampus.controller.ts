import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards, BadRequestException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GetAcademicSubjectsUseCase } from '@ecampus/application/use-cases/get-academic-subjects.usecase';
import { GetGradesUseCase } from '@ecampus/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@ecampus/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@ecampus/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@ecampus/application/use-cases/get-schedule.usecase';
import { GetProfileUseCase } from '@ecampus/application/use-cases/get-profile.usecase';
import { LoginUseCase } from '@ecampus/application/use-cases/login.usecase';
import { LogoutEcampusUseCase } from '@ecampus/application/use-cases/logout-ecampus.usecase';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import { CurrentEcampusCredentials } from '@ecampus/presentation/http/decorators/current-ecampus-credentials.decorator';
import { GetGradesQuery } from '@ecampus/presentation/http/dto/get-grades.query';
import type { LoginEcampusRequest } from '@ecampus/presentation/http/dto/login-ecampus.request';
import { EcampusJwtGuard } from '@ecampus/presentation/http/guards/ecampus-jwt.guard';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
import { isPendingScrapeJob } from '@/modules/ecampus/application/services/pending-scrape-job';
import type { EcampusCachedResource } from '@/shared/ecampus-cache';

@Controller('ecampus')
export class EcampusController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutEcampusUseCase,
    private readonly getAcademicSubjectsUseCase: GetAcademicSubjectsUseCase,
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly getGradesUseCase: GetGradesUseCase,
    private readonly getLessonPlanUseCase: GetLessonPlanUseCase,
    private readonly getLessonPlanSubjectsUseCase: GetLessonPlanSubjectsUseCase,
    private readonly jobService: JobService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'ecampus' };
  }

  @Post('login')
  async login(@Body() body: LoginEcampusRequest, @Res({ passthrough: true }) response: Response) {
    const { user, password } = body as any;
    if (!user || !password) {
      throw new BadRequestException('Missing credentials');
    }
    response.locals.ecampusDataSource = 'worker';
    response.locals.ecampusResource = 'login';
    return this.loginUseCase.execute({ cpf: user, password });
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(EcampusJwtGuard)
  async logout(@CurrentEcampusCredentials() credentials: EcampusCredentials, @Res({ passthrough: true }) response: Response) {
    response.locals.ecampusDataSource = 'worker';
    response.locals.ecampusResource = 'logout';
    await this.logoutUseCase.execute(credentials);
    return { status: 'ok' };
  }

  @Get('profile')
  @UseGuards(EcampusJwtGuard)
  async getStudentProfile(@CurrentEcampusCredentials() credentials: EcampusCredentials, @Res({ passthrough: true }) response: Response) {
    return this.respondWithResourceStatus(response, 'profile', await this.getProfileUseCase.execute(credentials));
  }

  @Get('schedule')
  @UseGuards(EcampusJwtGuard)
  async getSchedule(@CurrentEcampusCredentials() credentials: EcampusCredentials, @Res({ passthrough: true }) response: Response) {
    return this.respondWithResourceStatus(response, 'schedule', await this.getScheduleUseCase.execute(credentials));
  }

  @Get('grades')
  @UseGuards(EcampusJwtGuard)
  async getGrades(
    @CurrentEcampusCredentials() credentials: EcampusCredentials,
    @Res({ passthrough: true }) response: Response,
    @Query('year') year?: string,
    @Query('period') period?: string,
  ) {
    const input = new GetGradesQuery(year, period).toUseCaseInput();
    return this.respondWithResourceStatus(response, 'grades', await this.getGradesUseCase.execute({
      credentials,
      year: input.year,
      period: input.period,
    }));
  }

  @Get('lesson-plans/:planId')
  @UseGuards(EcampusJwtGuard)
  async getLessonPlan(
    @CurrentEcampusCredentials() credentials: EcampusCredentials,
    @Param('planId') planId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respondWithResourceStatus(response, 'lesson-plan', await this.getLessonPlanUseCase.execute(credentials, planId));
  }

  @Get('subjects')
  @UseGuards(EcampusJwtGuard)
  async getAcademicSubjects(
    @CurrentEcampusCredentials() credentials: EcampusCredentials,
    @Res({ passthrough: true }) response: Response,
    @Query('year') year?: string,
    @Query('period') period?: string,
  ) {
    const input = new GetGradesQuery(year, period).toUseCaseInput();
    return this.respondWithResourceStatus(response, 'academic-subjects', await this.getAcademicSubjectsUseCase.execute({
      credentials,
      year: input.year,
      period: input.period,
    }));
  }

  @Get('lesson-plans')
  @UseGuards(EcampusJwtGuard)
  async getLessonPlanSubjects(@CurrentEcampusCredentials() credentials: EcampusCredentials, @Res({ passthrough: true }) response: Response) {
    return this.respondWithResourceStatus(response, 'lesson-plan-subjects', await this.getLessonPlanSubjectsUseCase.execute(credentials));
  }
  // -----------------------------------------------------------------
  // Endpoint para enfileirar jobs manualmente (útil para depuração)
  // -----------------------------------------------------------------
  @Post('jobs/:type')
  @UseGuards(EcampusJwtGuard)
  async enqueueJob(
    @Param('type') type: string,
    @CurrentEcampusCredentials() credentials: EcampusCredentials,
    @Body() body: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    const allowed = ['profile', 'schedule', 'grades', 'lesson-plan-subjects', 'lesson-plan'];
    if (!allowed.includes(type)) {
      throw new BadRequestException('Invalid job type');
    }
    const data: Record<string, unknown> = { credentials };
    if (type === 'grades') {
      const { year, period } = body;
      if (!year || !period) {
        throw new BadRequestException('year and period are required for grades job');
      }
      data.year = year;
      data.period = period;
    }
    if (type === 'lesson-plan') {
      const { planId } = body;
      if (!planId) {
        throw new BadRequestException('planId is required for lesson-plan job');
      }
      data.planId = planId;
    }
    response.locals.ecampusDataSource = 'worker';
    response.locals.ecampusResource = type;
    const job = await this.jobService.enqueue(type, data);
    return { jobId: job.id };
  }

  private respondWithResourceStatus<T>(response: Response, resource: EcampusCachedResource | 'academic-subjects', result: T): T {
    if (isPendingScrapeJob(result)) {
      response.status(202);
      response.locals.ecampusDataSource = 'worker';
      response.locals.ecampusResource = result.resource;
      return result;
    }

    response.locals.ecampusDataSource = 'cache-aside';
    response.locals.ecampusResource = resource;
    return result;
  }
}

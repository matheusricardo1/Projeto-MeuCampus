import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards, BadRequestException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GetAcademicSubjectsUseCase } from '@academic/application/use-cases/get-academic-subjects.usecase';
import { GetGradesUseCase } from '@academic/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@academic/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@academic/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@academic/application/use-cases/get-schedule.usecase';
import { GetProfileUseCase } from '@academic/application/use-cases/get-profile.usecase';
import { LoginUseCase } from '@academic/application/use-cases/login.usecase';
import { LogoutAcademicSessionUseCase } from '@academic/application/use-cases/logout-academic-session.usecase';
import type { AcademicCredentials } from '@academic/domain/models/academic-credentials';
import { CurrentAcademicCredentials } from '@academic/presentation/http/decorators/current-academic-credentials.decorator';
import { GetGradesQuery } from '@academic/presentation/http/dto/get-grades.query';
import type { LoginAcademicRequest } from '@academic/presentation/http/dto/login-academic.request';
import { AcademicJwtGuard } from '@academic/presentation/http/guards/academic-jwt.guard';
import type { AcademicResource } from '@academic/domain/models/academic-resource';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import { isPendingScrapeJob } from '@/modules/academic/application/services/pending-scrape-job';

@Controller('ecampus')
export class AcademicController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutAcademicSessionUseCase,
    private readonly getAcademicSubjectsUseCase: GetAcademicSubjectsUseCase,
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly getGradesUseCase: GetGradesUseCase,
    private readonly getLessonPlanUseCase: GetLessonPlanUseCase,
    private readonly getLessonPlanSubjectsUseCase: GetLessonPlanSubjectsUseCase,
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'academic' };
  }

  @Post('login')
  async login(@Body() body: LoginAcademicRequest, @Res({ passthrough: true }) response: Response) {
    const { user, password } = body as any;
    if (!user || !password) {
      throw new BadRequestException('Missing credentials');
    }
    response.locals.academicDataSource = 'worker';
    response.locals.academicResource = 'login';
    return this.loginUseCase.execute({ cpf: user, password });
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AcademicJwtGuard)
  async logout(@CurrentAcademicCredentials() credentials: AcademicCredentials, @Res({ passthrough: true }) response: Response) {
    response.locals.academicDataSource = 'worker';
    response.locals.academicResource = 'logout';
    await this.logoutUseCase.execute(credentials);
    return { status: 'ok' };
  }

  @Get('profile')
  @UseGuards(AcademicJwtGuard)
  async getStudentProfile(@CurrentAcademicCredentials() credentials: AcademicCredentials, @Res({ passthrough: true }) response: Response) {
    return this.respondWithResourceStatus(response, 'profile', await this.getProfileUseCase.execute(credentials));
  }

  @Get('schedule')
  @UseGuards(AcademicJwtGuard)
  async getSchedule(@CurrentAcademicCredentials() credentials: AcademicCredentials, @Res({ passthrough: true }) response: Response) {
    return this.respondWithResourceStatus(response, 'schedule', await this.getScheduleUseCase.execute(credentials));
  }

  @Get('grades')
  @UseGuards(AcademicJwtGuard)
  async getGrades(
    @CurrentAcademicCredentials() credentials: AcademicCredentials,
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
  @UseGuards(AcademicJwtGuard)
  async getLessonPlan(
    @CurrentAcademicCredentials() credentials: AcademicCredentials,
    @Param('planId') planId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respondWithResourceStatus(response, 'lesson-plan', await this.getLessonPlanUseCase.execute(credentials, planId));
  }

  @Get('subjects')
  @UseGuards(AcademicJwtGuard)
  async getAcademicSubjects(
    @CurrentAcademicCredentials() credentials: AcademicCredentials,
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
  @UseGuards(AcademicJwtGuard)
  async getLessonPlanSubjects(@CurrentAcademicCredentials() credentials: AcademicCredentials, @Res({ passthrough: true }) response: Response) {
    return this.respondWithResourceStatus(response, 'lesson-plan-subjects', await this.getLessonPlanSubjectsUseCase.execute(credentials));
  }
  // -----------------------------------------------------------------
  // Endpoint para enfileirar jobs manualmente (útil para depuração)
  // -----------------------------------------------------------------
  @Post('jobs/:type')
  @UseGuards(AcademicJwtGuard)
  async enqueueJob(
    @Param('type') type: string,
    @CurrentAcademicCredentials() credentials: AcademicCredentials,
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
    response.locals.academicDataSource = 'worker';
    response.locals.academicResource = type;
    const job = await this.scrapingJobService.enqueue(type, data);
    return { jobId: job.id };
  }

  private respondWithResourceStatus<T>(response: Response, resource: AcademicResource | 'academic-subjects', result: T): T {
    if (isPendingScrapeJob(result)) {
      response.status(202);
      response.locals.academicDataSource = 'worker';
      response.locals.academicResource = result.resource;
      return result;
    }

    response.locals.academicDataSource = 'cache-aside';
    response.locals.academicResource = resource;
    return result;
  }
}

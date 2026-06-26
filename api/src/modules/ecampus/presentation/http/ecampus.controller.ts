import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { GetGradesUseCase } from '@ecampus/application/use-cases/get-grades.usecase';
import { GetLessonPlanUseCase } from '@ecampus/application/use-cases/get-lesson-plan.usecase';
import { GetLessonPlanSubjectsUseCase } from '@ecampus/application/use-cases/get-lesson-plan-subjects.usecase';
import { GetScheduleUseCase } from '@ecampus/application/use-cases/get-schedule.usecase';
import { GetProfileUseCase } from '@ecampus/application/use-cases/get-profile.usecase';
import { LoginUseCase } from '@ecampus/application/use-cases/login.usecase';
import { LogoutEcampusUseCase } from '@ecampus/application/use-cases/logout-ecampus.usecase';
import { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import { CurrentEcampusCredentials } from '@ecampus/presentation/http/decorators/current-ecampus-credentials.decorator';
import { GetGradesQuery } from '@ecampus/presentation/http/dto/get-grades.query';
import { GetLessonPlanParams } from '@ecampus/presentation/http/dto/get-lesson-plan.params';
import type { LoginEcampusRequest } from '@ecampus/presentation/http/dto/login-ecampus.request';
import { EcampusJwtGuard } from '@ecampus/presentation/http/guards/ecampus-jwt.guard';
import { JobService } from '@/modules/ecampus/application/ports/job-service';

@Controller('ecampus')
export class EcampusController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutEcampusUseCase,
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
  async login(@Body() body: LoginEcampusRequest) {
    return this.loginUseCase.execute({ cpf: body?.user, password: body?.password });
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(EcampusJwtGuard)
  async logout(@CurrentEcampusCredentials() credentials: EcampusCredentials) {
    await this.logoutUseCase.execute(credentials);
    return { status: 'ok' };
  }

  @Get('profile')
  @UseGuards(EcampusJwtGuard)
  async getStudentProfile(@CurrentEcampusCredentials() credentials: EcampusCredentials) {
    return this.getProfileUseCase.execute(credentials);
  }

  @Get('schedule')
  @UseGuards(EcampusJwtGuard)
  async getSchedule(@CurrentEcampusCredentials() credentials: EcampusCredentials) {
    return this.getScheduleUseCase.execute(credentials);
  }

  @Get('grades')
  @UseGuards(EcampusJwtGuard)
  async getGrades(
    @CurrentEcampusCredentials() credentials: EcampusCredentials,
    @Query('year') year?: string,
    @Query('period') period?: string,
  ) {
    const input = new GetGradesQuery(year, period).toUseCaseInput();
    return this.getGradesUseCase.execute({
      credentials,
      year: input.year,
      period: input.period,
    });
  }

  @Get('lesson-plans/:planId')
  @UseGuards(EcampusJwtGuard)
  async getLessonPlan(
    @CurrentEcampusCredentials() credentials: EcampusCredentials,
    @Param('planId') planId: string,
  ) {
    return this.getLessonPlanUseCase.execute(credentials, planId);
  }

  @Get('lesson-plans')
  @UseGuards(EcampusJwtGuard)
  async getLessonPlanSubjects(@CurrentEcampusCredentials() credentials: EcampusCredentials) {
    return this.getLessonPlanSubjectsUseCase.execute(credentials);
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
    const job = await this.jobService.enqueue(type, data);
    return { jobId: job.id };
  }
}

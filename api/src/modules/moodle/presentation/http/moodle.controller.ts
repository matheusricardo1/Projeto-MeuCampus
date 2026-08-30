import { Body, Controller, Get, HttpCode, Param, Post, UseGuards, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { LoginMoodleUseCase } from '@moodle/application/use-cases/login-moodle.usecase';
import { LogoutMoodleUseCase } from '@moodle/application/use-cases/logout-moodle.usecase';
import { GetCoursesUseCase } from '@moodle/application/use-cases/get-courses.usecase';
import { GetTimelineUseCase } from '@moodle/application/use-cases/get-timeline.usecase';
import { LinkMoodleAccountUseCase } from '@moodle/application/use-cases/link-moodle-account.usecase';
import { UnlinkMoodleAccountUseCase } from '@moodle/application/use-cases/unlink-moodle-account.usecase';
import { ListLinkedMoodleAccountsUseCase } from '@moodle/application/use-cases/list-linked-moodle-accounts.usecase';
import { MoodleAuthGuard } from '@moodle/presentation/http/guards/moodle-auth.guard';
import { CurrentMoodleCredentials } from '@moodle/presentation/http/decorators/current-moodle-credentials.decorator';
import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';
import { MOODLE_INSTANCES, isMoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';
import { AcademicAuthGuard } from '@auth/presentation/http/guards/academic-auth.guard';
import { CurrentAcademicCredentials } from '@auth/presentation/http/decorators/current-academic-credentials.decorator';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';

@Controller('moodle')
export class MoodleController {
    constructor(
        private readonly loginUseCase: LoginMoodleUseCase,
        private readonly logoutUseCase: LogoutMoodleUseCase,
        private readonly getCoursesUseCase: GetCoursesUseCase,
        private readonly getTimelineUseCase: GetTimelineUseCase,
        private readonly linkAccountUseCase: LinkMoodleAccountUseCase,
        private readonly unlinkAccountUseCase: UnlinkMoodleAccountUseCase,
        private readonly listLinkedAccountsUseCase: ListLinkedMoodleAccountsUseCase
    ) {}

    @Get('health')
    health() {
        return { status: 'ok', module: 'moodle' };
    }

    @Get('instances')
    listInstances() {
        return MOODLE_INSTANCES;
    }

    @Post('login')
    @HttpCode(200)
    async login(@Body() body: { instanceId?: string; username?: string; password?: string }) {
        if (!body.instanceId || !body.username || !body.password) {
            throw new BadRequestException('Missing instanceId, username or password');
        }

        if (!isMoodleInstanceId(body.instanceId)) {
            throw new BadRequestException(`Unknown Moodle instance: ${body.instanceId}`);
        }

        try {
            return await this.loginUseCase.execute({ instanceId: body.instanceId, username: body.username, password: body.password });
        } catch (error) {
            throw new UnauthorizedException(error instanceof Error ? error.message : 'Moodle login failed.');
        }
    }

    @Post('logout')
    @HttpCode(200)
    @UseGuards(MoodleAuthGuard)
    async logout(@CurrentMoodleCredentials() credentials: MoodleCredentials) {
        await this.logoutUseCase.execute(credentials);
        return { status: 'ok' };
    }

    @Get('courses')
    @UseGuards(MoodleAuthGuard)
    async getCourses(@CurrentMoodleCredentials() credentials: MoodleCredentials) {
        return this.getCoursesUseCase.execute(credentials);
    }

    @Get('timeline')
    @UseGuards(MoodleAuthGuard)
    async getTimeline(@CurrentMoodleCredentials() credentials: MoodleCredentials) {
        return this.getTimelineUseCase.execute(credentials);
    }

    // --- Account linking ("simulated SSO") — authenticated via the app's PRIMARY
    // login (eCampus), not the Moodle-specific guard above, since linking a
    // Moodle account is exactly how that Moodle JWT gets created in the first
    // place. See LinkMoodleAccountUseCase for why the credential is verified
    // against Moodle for real before anything is persisted. ---

    @Get('accounts')
    @UseGuards(AcademicAuthGuard)
    async listLinkedAccounts(@CurrentAcademicCredentials() credentials: AcademicCredentials) {
        return this.listLinkedAccountsUseCase.execute(credentials.cpf);
    }

    @Post('accounts/link')
    @HttpCode(200)
    @UseGuards(AcademicAuthGuard)
    async linkAccount(
        @CurrentAcademicCredentials() credentials: AcademicCredentials,
        @Body() body: { instanceId?: string; username?: string; password?: string }
    ) {
        if (!body.instanceId || !body.username || !body.password) {
            throw new BadRequestException('Missing instanceId, username or password');
        }

        if (!isMoodleInstanceId(body.instanceId)) {
            throw new BadRequestException(`Unknown Moodle instance: ${body.instanceId}`);
        }

        try {
            await this.linkAccountUseCase.execute({
                cpf: credentials.cpf,
                instanceId: body.instanceId,
                username: body.username,
                password: body.password
            });
            return { status: 'ok' };
        } catch (error) {
            throw new UnauthorizedException(error instanceof Error ? error.message : 'Nao foi possivel conectar sua conta do Moodle.');
        }
    }

    @Post('accounts/:instanceId/unlink')
    @HttpCode(200)
    @UseGuards(AcademicAuthGuard)
    async unlinkAccount(@CurrentAcademicCredentials() credentials: AcademicCredentials, @Param('instanceId') instanceId: string) {
        if (!isMoodleInstanceId(instanceId)) {
            throw new BadRequestException(`Unknown Moodle instance: ${instanceId}`);
        }

        const removed = await this.unlinkAccountUseCase.execute(credentials.cpf, instanceId);
        return { status: 'ok', removed };
    }
}

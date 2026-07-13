import { Body, Controller, Get, Post, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AdminLoginUseCase } from '@admin/application/use-cases/admin-login.usecase';
import { GetAdminMetricsUseCase } from '@admin/application/use-cases/get-admin-metrics.usecase';
import { GetAiUsageTodayUseCase } from '@admin/application/use-cases/get-ai-usage-today.usecase';
import { AdminAuthGuard } from '@admin/presentation/http/guards/admin-auth.guard';
import { InvalidAdminCredentialsException } from '@admin/domain/exceptions/invalid-admin-credentials.exception';

@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminLoginUseCase: AdminLoginUseCase,
        private readonly getAdminMetricsUseCase: GetAdminMetricsUseCase,
        private readonly getAiUsageTodayUseCase: GetAiUsageTodayUseCase
    ) {}

    @Post('auth/login')
    login(@Body() body: { email?: string; password?: string }) {
        if (!body.email || !body.password) {
            throw new InvalidAdminCredentialsException();
        }

        try {
            return this.adminLoginUseCase.execute({ email: body.email, password: body.password });
        } catch (error) {
            if (error instanceof InvalidAdminCredentialsException) {
                throw new UnauthorizedException(error.message);
            }
            throw error;
        }
    }

    @Get('metrics')
    @UseGuards(AdminAuthGuard)
    async metrics() {
        return this.getAdminMetricsUseCase.execute();
    }

    @Get('ai-usage/today')
    @UseGuards(AdminAuthGuard)
    async aiUsageToday() {
        return this.getAiUsageTodayUseCase.execute();
    }
}

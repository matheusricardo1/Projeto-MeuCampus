import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Post, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AdminLoginUseCase } from '@admin/application/use-cases/admin-login.usecase';
import { GetAdminMetricsUseCase } from '@admin/application/use-cases/get-admin-metrics.usecase';
import { GetAiUsageTodayUseCase } from '@admin/application/use-cases/get-ai-usage-today.usecase';
import { AdminAuthGuard } from '@admin/presentation/http/guards/admin-auth.guard';
import { InvalidAdminCredentialsException } from '@admin/domain/exceptions/invalid-admin-credentials.exception';
import { PushSubscriptionRepository } from '@push/infrastructure/prisma/push-subscription.repository';

interface PushSubscribeRequest {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
}

@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminLoginUseCase: AdminLoginUseCase,
        private readonly getAdminMetricsUseCase: GetAdminMetricsUseCase,
        private readonly getAiUsageTodayUseCase: GetAiUsageTodayUseCase,
        private readonly pushSubscriptionRepository: PushSubscriptionRepository
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

    @Get('push/public-key')
    @UseGuards(AdminAuthGuard)
    getPushPublicKey() {
        return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
    }

    @Post('push/subscribe')
    @UseGuards(AdminAuthGuard)
    @HttpCode(204)
    async subscribeToPush(@Body() body: PushSubscribeRequest) {
        if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
            throw new BadRequestException('Inscricao push invalida.');
        }

        await this.pushSubscriptionRepository.save({
            endpoint: body.endpoint,
            p256dh: body.keys.p256dh,
            auth: body.keys.auth
        });
    }

    @Delete('push/subscribe')
    @UseGuards(AdminAuthGuard)
    @HttpCode(204)
    async unsubscribeFromPush(@Body() body: { endpoint?: string }) {
        if (!body.endpoint) {
            return;
        }

        await this.pushSubscriptionRepository.remove(body.endpoint);
    }
}

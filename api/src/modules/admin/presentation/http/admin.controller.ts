import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AdminLoginUseCase } from '@admin/application/use-cases/admin-login.usecase';
import { GetAdminMetricsUseCase } from '@admin/application/use-cases/get-admin-metrics.usecase';
import { GetAiUsageTodayUseCase } from '@admin/application/use-cases/get-ai-usage-today.usecase';
import { AdminAuthGuard } from '@admin/presentation/http/guards/admin-auth.guard';
import { InvalidAdminCredentialsException } from '@admin/domain/exceptions/invalid-admin-credentials.exception';
import { PushSubscriptionRepository } from '@push/infrastructure/prisma/push-subscription.repository';
import { CommunityPostRepository } from '@community/infrastructure/prisma/community-post.repository';

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
        private readonly pushSubscriptionRepository: PushSubscriptionRepository,
        private readonly communityPostRepository: CommunityPostRepository
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

    // --- Community moderation -------------------------------------------------

    @Get('community/pending')
    @UseGuards(AdminAuthGuard)
    async pendingCommunityPosts() {
        const posts = await this.communityPostRepository.listPending();
        return posts.map((post) => ({
            id: post.id,
            authorName: post.authorName,
            category: post.category,
            body: post.body,
            payload: post.payload,
            createdAt: post.createdAt.toISOString()
        }));
    }

    @Post('community/:id/approve')
    @UseGuards(AdminAuthGuard)
    @HttpCode(200)
    async approveCommunityPost(@Param('id') id: string) {
        const ok = await this.communityPostRepository.setStatus(id, 'APPROVED');
        if (!ok) {
            throw new NotFoundException('Post nao encontrado.');
        }
        return { status: 'ok' };
    }

    @Post('community/:id/reject')
    @UseGuards(AdminAuthGuard)
    @HttpCode(200)
    async rejectCommunityPost(@Param('id') id: string) {
        const ok = await this.communityPostRepository.setStatus(id, 'REJECTED');
        if (!ok) {
            throw new NotFoundException('Post nao encontrado.');
        }
        return { status: 'ok' };
    }
}

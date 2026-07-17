import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AdminLoginUseCase } from '@admin/application/use-cases/admin-login.usecase';
import { GetAdminMetricsUseCase } from '@admin/application/use-cases/get-admin-metrics.usecase';
import { GetAiUsageTodayUseCase } from '@admin/application/use-cases/get-ai-usage-today.usecase';
import { AdminAuthGuard } from '@admin/presentation/http/guards/admin-auth.guard';
import { InvalidAdminCredentialsException } from '@admin/domain/exceptions/invalid-admin-credentials.exception';
import { PushSubscriptionRepository } from '@push/infrastructure/prisma/push-subscription.repository';
import { CommunityPostRepository } from '@community/infrastructure/prisma/community-post.repository';
import { GlobalDataRepository } from '@global-data/infrastructure/prisma/global-data.repository';
import { isGlobalDataType, type GlobalDataPayload } from '@global-data/domain/global-data.entity';

interface PushSubscribeRequest {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
}

interface CreateGlobalDataRequest {
    type?: string;
    title?: string;
    payload?: unknown;
}

const MAX_GLOBAL_DATA_PAYLOAD_JSON_LENGTH = 4000;

/** Keeps only plain string/number/boolean fields, bounded in size, to avoid
 *  storing arbitrary nested JSON the AI shouldn't ingest. */
function sanitizeGlobalDataPayload(payload: unknown): GlobalDataPayload | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }
    const entries = Object.entries(payload as Record<string, unknown>)
        .filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean');
    if (entries.length === 0) return null;
    const clean = Object.fromEntries(entries) as GlobalDataPayload;
    if (JSON.stringify(clean).length > MAX_GLOBAL_DATA_PAYLOAD_JSON_LENGTH) {
        throw new BadRequestException('Dados globais muito grandes.');
    }
    return clean;
}

@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminLoginUseCase: AdminLoginUseCase,
        private readonly getAdminMetricsUseCase: GetAdminMetricsUseCase,
        private readonly getAiUsageTodayUseCase: GetAiUsageTodayUseCase,
        private readonly pushSubscriptionRepository: PushSubscriptionRepository,
        private readonly communityPostRepository: CommunityPostRepository,
        private readonly globalDataRepository: GlobalDataRepository
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

    // --- Global data (official campus data for the AI) ------------------------

    @Get('global-data')
    @UseGuards(AdminAuthGuard)
    async listGlobalData() {
        const items = await this.globalDataRepository.listAll();
        return items.map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            payload: item.payload,
            active: item.active,
            updatedAt: item.updatedAt.toISOString()
        }));
    }

    @Post('global-data')
    @UseGuards(AdminAuthGuard)
    async createGlobalData(@Body() body: CreateGlobalDataRequest) {
        if (!isGlobalDataType(body.type)) {
            throw new BadRequestException('Tipo de dado global invalido.');
        }
        const title = (body.title ?? '').trim();
        if (!title) {
            throw new BadRequestException('Titulo obrigatorio.');
        }

        const created = await this.globalDataRepository.create({
            type: body.type,
            title: title.slice(0, 200),
            payload: sanitizeGlobalDataPayload(body.payload)
        });
        return {
            id: created.id,
            type: created.type,
            title: created.title,
            payload: created.payload,
            active: created.active,
            updatedAt: created.updatedAt.toISOString()
        };
    }

    @Patch('global-data/:id')
    @UseGuards(AdminAuthGuard)
    @HttpCode(200)
    async toggleGlobalData(@Param('id') id: string, @Body() body: { active?: boolean }) {
        const ok = await this.globalDataRepository.setActive(id, body.active !== false);
        if (!ok) {
            throw new NotFoundException('Dado global nao encontrado.');
        }
        return { status: 'ok' };
    }

    @Delete('global-data/:id')
    @UseGuards(AdminAuthGuard)
    @HttpCode(200)
    async deleteGlobalData(@Param('id') id: string) {
        const ok = await this.globalDataRepository.delete(id);
        if (!ok) {
            throw new NotFoundException('Dado global nao encontrado.');
        }
        return { status: 'ok' };
    }
}

import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AcademicAuthGuard } from '@auth/presentation/http/guards/academic-auth.guard';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { pseudonymousUserId } from '@/shared/security/pseudonymous-user-id';
import { appLogger } from '@/shared/logging/app-logger';
import { UserPlanRepository } from '@billing/infrastructure/prisma/user-plan.repository';
import { MercadoPagoPaymentService } from '@billing/infrastructure/mercadopago/mercadopago-payment.service';

const PAID_PLAN_PRICE_CENTS = 2000;
const PAID_PLAN_DAYS = 30;

interface RequestWithAcademicCredentials extends Request {
    academicCredentials?: AcademicCredentials;
}

@Controller('billing')
export class BillingController {
    constructor(
        private readonly userPlanRepository: UserPlanRepository,
        private readonly mercadoPago: MercadoPagoPaymentService
    ) {}

    @Get('plan')
    @UseGuards(AcademicAuthGuard)
    async getPlan(@Req() request: RequestWithAcademicCredentials) {
        const userId = pseudonymousUserId(this.requireCpf(request));
        return this.userPlanRepository.getPlan(userId);
    }

    @Post('checkout/pix')
    @UseGuards(AcademicAuthGuard)
    @HttpCode(201)
    async createPixCheckout(@Req() request: RequestWithAcademicCredentials) {
        const userId = pseudonymousUserId(this.requireCpf(request));

        const paymentId = await this.userPlanRepository.createPendingPayment(userId, {
            amountCents: PAID_PLAN_PRICE_CENTS,
            planDays: PAID_PLAN_DAYS
        });

        const pix = await this.mercadoPago.createPixPayment({
            internalPaymentId: paymentId,
            amountCents: PAID_PLAN_PRICE_CENTS,
            description: 'UfamAcademics IA - Plano 100 mensagens/dia (30 dias)',
            payerEmail: `${userId}@ufamacademics.pix`
        });

        await this.userPlanRepository.attachMercadoPagoId(paymentId, pix.mpPaymentId);

        return {
            paymentId,
            qrCode: pix.qrCode,
            qrCodeBase64: pix.qrCodeBase64,
            expiresAt: pix.expiresAt
        };
    }

    @Get('checkout/:paymentId/status')
    @UseGuards(AcademicAuthGuard)
    async getCheckoutStatus(@Param('paymentId') paymentId: string) {
        const status = await this.userPlanRepository.getPaymentStatus(paymentId);
        if (!status) {
            throw new BadRequestException('Pagamento nao encontrado.');
        }
        return { status };
    }

    @Post('webhook/mercadopago')
    @HttpCode(200)
    async handleWebhook(
        @Body() body: { data?: { id?: string }; type?: string },
        @Headers('x-signature') xSignature?: string,
        @Headers('x-request-id') xRequestId?: string
    ) {
        const dataId = body?.data?.id;
        if (body?.type !== 'payment' || !dataId) {
            return { received: true };
        }

        if (!xSignature || !xRequestId || !this.mercadoPago.verifyWebhookSignature({ xSignature, xRequestId, dataId })) {
            appLogger.warning('Webhook do Mercado Pago com assinatura invalida.', { dataId });
            throw new BadRequestException('Assinatura invalida.');
        }

        const status = await this.mercadoPago.getPaymentStatus(dataId);

        if (status === 'APPROVED') {
            await this.userPlanRepository.approvePayment(dataId);
        } else if (status === 'REJECTED' || status === 'EXPIRED') {
            await this.userPlanRepository.markPaymentStatus(dataId, status);
        }

        return { received: true };
    }

    private requireCpf(request: RequestWithAcademicCredentials): string {
        const cpf = request.academicCredentials?.cpf;
        if (!cpf) {
            throw new BadRequestException('Sessao invalida.');
        }
        return cpf;
    }
}

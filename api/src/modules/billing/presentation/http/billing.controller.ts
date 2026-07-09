import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AcademicAuthGuard } from '@auth/presentation/http/guards/academic-auth.guard';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { normalizeCpf, pseudonymousUserId } from '@/shared/security/pseudonymous-user-id';
import { appLogger } from '@/shared/logging/app-logger';
import { UserPlanRepository } from '@billing/infrastructure/prisma/user-plan.repository';
import { MercadoPagoPaymentService } from '@billing/infrastructure/mercadopago/mercadopago-payment.service';

const PAID_PLAN_PRICE_CENTS = 2000;
const PAID_PLAN_DAYS = 30;

interface RequestWithAcademicCredentials extends Request {
    academicCredentials?: AcademicCredentials;
}

interface CreateCardCheckoutRequest {
    token?: string;
    paymentMethodId?: string;
    issuerId?: string;
    installments?: number;
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

    @Get('mercadopago/public-key')
    @UseGuards(AcademicAuthGuard)
    getPublicKey() {
        return { publicKey: this.mercadoPago.getPublicKey(), amount: PAID_PLAN_PRICE_CENTS / 100 };
    }

    @Post('checkout/card')
    @UseGuards(AcademicAuthGuard)
    @HttpCode(201)
    async createCardCheckout(@Req() request: RequestWithAcademicCredentials, @Body() body: CreateCardCheckoutRequest) {
        const cpf = this.requireCpf(request);
        const userId = pseudonymousUserId(cpf);
        const payerCpf = normalizeCpf(cpf);

        if (!body?.token || !body?.paymentMethodId || !body?.installments) {
            throw new BadRequestException('Dados do cartao incompletos.');
        }

        if (payerCpf.length !== 11) {
            throw new BadRequestException('CPF invalido para pagamento com cartao.');
        }

        const paymentId = await this.userPlanRepository.createPendingPayment(userId, {
            amountCents: PAID_PLAN_PRICE_CENTS,
            planDays: PAID_PLAN_DAYS
        });

        const card = await this.mercadoPago.createCardPayment({
            internalPaymentId: paymentId,
            amountCents: PAID_PLAN_PRICE_CENTS,
            description: 'UfamAcademics IA - Plano 100 mensagens/dia (30 dias)',
            payerEmail: `${userId}@ufamacademics.card`,
            payerCpf,
            token: body.token,
            paymentMethodId: body.paymentMethodId,
            ...(body.issuerId ? { issuerId: body.issuerId } : {}),
            installments: body.installments
        });

        await this.userPlanRepository.attachMercadoPagoId(paymentId, card.mpPaymentId);

        if (card.status === 'APPROVED') {
            await this.userPlanRepository.approvePayment(card.mpPaymentId);
        } else if (card.status === 'REJECTED' || card.status === 'EXPIRED') {
            await this.userPlanRepository.markPaymentStatus(card.mpPaymentId, card.status);
        }

        return { paymentId, status: card.status, statusDetail: card.statusDetail };
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
        @Body() body: { type?: string },
        @Query('data.id') queryDataId?: string,
        @Headers('x-signature') xSignature?: string,
        @Headers('x-request-id') xRequestId?: string
    ) {
        const dataId = queryDataId;
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

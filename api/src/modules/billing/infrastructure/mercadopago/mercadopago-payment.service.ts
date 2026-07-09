import { Injectable } from '@nestjs/common';
import { InvalidWebhookSignatureError, MercadoPagoConfig, Payment, WebhookSignatureValidator } from 'mercadopago';
import { appLogger } from '@/shared/logging/app-logger';

const WEBHOOK_TOLERANCE_SECONDS = 300;

export interface PixPayment {
    mpPaymentId: string;
    qrCode: string;
    qrCodeBase64: string;
    expiresAt: string;
}

export interface CardPaymentResult {
    mpPaymentId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    statusDetail: string;
}

@Injectable()
export class MercadoPagoPaymentService {
    private readonly client: Payment;
    private readonly publicKey: string;

    constructor() {
        const accessToken = requireEnv('MERCADOPAGO_ACCESS_TOKEN');
        this.publicKey = requireEnv('MERCADOPAGO_PUBLIC_KEY');
        this.client = new Payment(new MercadoPagoConfig({ accessToken }));
    }

    getPublicKey(): string {
        return this.publicKey;
    }

    async createPixPayment(params: {
        internalPaymentId: string;
        amountCents: number;
        description: string;
        payerEmail: string;
    }): Promise<PixPayment> {
        const webhookUrl = process.env.MERCADOPAGO_WEBHOOK_URL;

        const response = await this.client.create({
            body: {
                transaction_amount: params.amountCents / 100,
                description: params.description,
                payment_method_id: 'pix',
                payer: { email: params.payerEmail },
                external_reference: params.internalPaymentId,
                ...(webhookUrl ? { notification_url: webhookUrl } : {})
            }
        });

        const pointOfInteraction = response.point_of_interaction?.transaction_data;
        if (!response.id || !pointOfInteraction?.qr_code || !pointOfInteraction?.qr_code_base64) {
            appLogger.error('Falha ao criar pagamento PIX no Mercado Pago.', { internalPaymentId: params.internalPaymentId });
            throw new Error('Nao foi possivel gerar o pagamento PIX.');
        }

        return {
            mpPaymentId: String(response.id),
            qrCode: pointOfInteraction.qr_code,
            qrCodeBase64: pointOfInteraction.qr_code_base64,
            expiresAt: response.date_of_expiration || ''
        };
    }

    async createCardPayment(params: {
        internalPaymentId: string;
        amountCents: number;
        description: string;
        payerEmail: string;
        payerCpf: string;
        token: string;
        paymentMethodId: string;
        issuerId?: string;
        installments: number;
    }): Promise<CardPaymentResult> {
        const webhookUrl = process.env.MERCADOPAGO_WEBHOOK_URL;

        const response = await this.client.create({
            body: {
                transaction_amount: params.amountCents / 100,
                description: params.description,
                token: params.token,
                payment_method_id: params.paymentMethodId,
                installments: params.installments,
                ...(params.issuerId ? { issuer_id: Number(params.issuerId) } : {}),
                payer: {
                    email: params.payerEmail,
                    identification: { type: 'CPF', number: params.payerCpf }
                },
                external_reference: params.internalPaymentId,
                ...(webhookUrl ? { notification_url: webhookUrl } : {})
            }
        });

        if (!response.id) {
            appLogger.error('Falha ao criar pagamento com cartao no Mercado Pago.', { internalPaymentId: params.internalPaymentId });
            throw new Error('Nao foi possivel processar o pagamento com cartao.');
        }

        return {
            mpPaymentId: String(response.id),
            status: mapStatus(response.status),
            statusDetail: response.status_detail || ''
        };
    }

    async getPaymentStatus(mpPaymentId: string): Promise<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'> {
        const response = await this.client.get({ id: mpPaymentId });
        return mapStatus(response.status);
    }

    /**
     * Validates the x-signature header via the official SDK utility.
     * `dataId` must be the `data.id` QUERY STRING parameter (not the JSON
     * body) — Mercado Pago's manifest is signed over the query value, and
     * hashing the body's `data.id` instead produces a mismatch on every
     * real webhook.
     */
    verifyWebhookSignature(params: { xSignature: string; xRequestId: string; dataId: string }): boolean {
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!secret) {
            appLogger.critical('MERCADOPAGO_WEBHOOK_SECRET nao configurado - rejeitando webhook.');
            return false;
        }

        try {
            WebhookSignatureValidator.validate({
                xSignature: params.xSignature,
                xRequestId: params.xRequestId,
                dataId: params.dataId,
                secret,
                toleranceSeconds: WEBHOOK_TOLERANCE_SECONDS
            });
            return true;
        } catch (error) {
            if (error instanceof InvalidWebhookSignatureError) {
                appLogger.warning('Assinatura de webhook do Mercado Pago invalida.', { reason: error.reason, requestId: error.requestId });
                return false;
            }
            throw error;
        }
    }
}

function mapStatus(status?: string): 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' {
    if (status === 'approved') return 'APPROVED';
    if (status === 'rejected' || status === 'cancelled') return 'REJECTED';
    if (status === 'expired') return 'EXPIRED';
    return 'PENDING';
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`CONFIGURACAO ERRO: ${name} nao esta definida nas variaveis de ambiente!`);
    }
    return value;
}

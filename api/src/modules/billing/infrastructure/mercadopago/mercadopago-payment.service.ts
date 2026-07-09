import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { appLogger } from '@/shared/logging/app-logger';

export interface PixPayment {
    mpPaymentId: string;
    qrCode: string;
    qrCodeBase64: string;
    expiresAt: string;
}

@Injectable()
export class MercadoPagoPaymentService {
    private readonly client: Payment;

    constructor() {
        const accessToken = requireEnv('MERCADOPAGO_ACCESS_TOKEN');
        this.client = new Payment(new MercadoPagoConfig({ accessToken }));
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

    async getPaymentStatus(mpPaymentId: string): Promise<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'> {
        const response = await this.client.get({ id: mpPaymentId });
        return mapStatus(response.status);
    }

    /**
     * Validates the x-signature header per Mercado Pago's webhook spec:
     * HMAC-SHA256("id:{dataId};request-id:{xRequestId};ts:{ts};", secret).
     */
    verifyWebhookSignature(params: { xSignature: string; xRequestId: string; dataId: string }): boolean {
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!secret) {
            appLogger.critical('MERCADOPAGO_WEBHOOK_SECRET nao configurado - rejeitando webhook.');
            return false;
        }

        const parts = Object.fromEntries(
            params.xSignature.split(',').map((entry) => {
                const [key, value] = entry.split('=');
                return [key?.trim(), value?.trim()];
            })
        );

        const ts = parts.ts;
        const receivedHash = parts.v1;
        if (!ts || !receivedHash) return false;

        const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId};ts:${ts};`;
        const expectedHash = createHmac('sha256', secret).update(manifest).digest('hex');

        const expected = Buffer.from(expectedHash, 'utf8');
        const received = Buffer.from(receivedHash, 'utf8');
        return expected.length === received.length && timingSafeEqual(expected, received);
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

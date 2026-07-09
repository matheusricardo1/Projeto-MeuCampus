import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { spacing } from '@/shared/design-system';
import type { MercadoPagoCardBrickProps } from './mercadopago-card-brick.types';

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const CONTAINER_ID = 'cardPaymentBrick_container';

declare global {
    interface Window {
        MercadoPago?: new (publicKey: string, options?: { locale?: string }) => {
            bricks: () => {
                create: (brickType: string, containerId: string, settings: unknown) => Promise<{ unmount: () => void }>;
            };
        };
    }
}

export function MercadoPagoCardBrick({ publicKey, amount, onToken, onError }: MercadoPagoCardBrickProps) {
    const controllerRef = useRef<{ unmount: () => void } | null>(null);

    useEffect(() => {
        let cancelled = false;

        loadSdk()
            .then(() => {
                if (cancelled || !window.MercadoPago) return;

                const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
                return mp.bricks().create('cardPayment', CONTAINER_ID, {
                    initialization: { amount },
                    customization: {
                        paymentMethods: { minInstallments: 1, maxInstallments: 1 }
                    },
                    callbacks: {
                        onError: (error: unknown) => {
                            onError(describeBrickError(error));
                        },
                        onSubmit: (cardFormData: Record<string, unknown>) => new Promise<void>((resolve, reject) => {
                            const token = typeof cardFormData.token === 'string' ? cardFormData.token : undefined;
                            const paymentMethodId = typeof cardFormData.payment_method_id === 'string' ? cardFormData.payment_method_id : undefined;
                            if (!token || !paymentMethodId) {
                                reject();
                                onError('Nao foi possivel validar os dados do cartao.');
                                return;
                            }

                            onToken({
                                token,
                                paymentMethodId,
                                ...(typeof cardFormData.issuer_id === 'string' ? { issuerId: cardFormData.issuer_id } : {}),
                                installments: typeof cardFormData.installments === 'number' ? cardFormData.installments : 1
                            });
                            resolve();
                        })
                    }
                });
            })
            .then((controller) => {
                if (cancelled) {
                    controller?.unmount();
                    return;
                }
                controllerRef.current = controller ?? null;
            })
            .catch(() => onError('Nao foi possivel carregar o formulario de pagamento.'));

        return () => {
            cancelled = true;
            controllerRef.current?.unmount();
            controllerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [publicKey, amount]);

    return (
        <View style={{ gap: spacing[2], minHeight: 260, width: '100%' }}>
            <View nativeID={CONTAINER_ID} />
        </View>
    );
}

function loadSdk(): Promise<void> {
    if (window.MercadoPago) return Promise.resolve();

    const existing = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existing) {
        return new Promise((resolve) => existing.addEventListener('load', () => resolve()));
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SDK_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Falha ao carregar o SDK do Mercado Pago.'));
        document.head.appendChild(script);
    });
}

function describeBrickError(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        return (error as { message: string }).message;
    }
    return 'Dados do cartao invalidos. Confira e tente novamente.';
}

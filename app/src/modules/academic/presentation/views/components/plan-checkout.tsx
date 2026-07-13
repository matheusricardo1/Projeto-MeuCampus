import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/shared/design-system';
import { MercadoPagoCardBrick } from '@/modules/academic/presentation/views/components/mercadopago-card-brick';
import type { CardBrickTokenResult } from '@/modules/academic/presentation/views/components/mercadopago-card-brick.types';
import type { CreateCardCheckoutRequest } from '@/modules/academic/domain/repositories/ecampus-repository';

export type PixCheckout = { paymentId: string; qrCode: string; qrCodeBase64: string; expiresAt: string };
export type CheckoutStatus = { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' };
export type CardCheckoutResult = { paymentId: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'; statusDetail: string };

type PaymentMethodTab = 'pix' | 'card';

// The "how do you want to pay" step of the upgrade flow — shared between the
// AI daily-limit paywall (ai.tsx) and the profile "Plano" screen, so the two
// entry points can never drift into two different checkout implementations.
export function PlanCheckoutFlow({
    active,
    onCreateCardCheckout,
    onCreatePixCheckout,
    onGetCheckoutStatus,
    onGetMercadoPagoPublicKey,
    onPaymentApproved
}: {
    active: boolean;
    onCreateCardCheckout?: (input: CreateCardCheckoutRequest) => Promise<CardCheckoutResult>;
    onCreatePixCheckout?: () => Promise<PixCheckout>;
    onGetCheckoutStatus?: (paymentId: string) => Promise<CheckoutStatus>;
    onGetMercadoPagoPublicKey?: () => Promise<{ publicKey: string; amount: number }>;
    onPaymentApproved: () => void;
}) {
    const [method, setMethod] = useState<PaymentMethodTab>('pix');

    const [checkout, setCheckout] = useState<PixCheckout | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const [mercadoPagoConfig, setMercadoPagoConfig] = useState<{ publicKey: string; amount: number } | null>(null);
    const [publicKeyError, setPublicKeyError] = useState<string | null>(null);
    const [cardPaymentId, setCardPaymentId] = useState<string | null>(null);
    const [cardStatus, setCardStatus] = useState<'idle' | 'submitting' | 'pending' | 'rejected'>('idle');
    const [cardError, setCardError] = useState<string | null>(null);
    const [brickKey, setBrickKey] = useState(0);

    useEffect(() => {
        if (!active) {
            setMethod('pix');
            setCheckout(null);
            setCheckoutError(null);
            setMercadoPagoConfig(null);
            setPublicKeyError(null);
            setCardPaymentId(null);
            setCardStatus('idle');
            setCardError(null);
        }
    }, [active]);

    useEffect(() => {
        if (!active || method !== 'pix' || checkout) return;

        let cancelled = false;
        setIsCreating(true);
        setCheckoutError(null);

        onCreatePixCheckout?.()
            .then((result) => {
                if (!cancelled) setCheckout(result);
            })
            .catch(() => {
                if (!cancelled) setCheckoutError('Nao foi possivel gerar o pagamento PIX. Tente novamente.');
            })
            .finally(() => {
                if (!cancelled) setIsCreating(false);
            });

        return () => { cancelled = true; };
    }, [active, method, checkout, onCreatePixCheckout]);

    useEffect(() => {
        if (!active || method !== 'pix' || !checkout || !onGetCheckoutStatus) return;

        const interval = setInterval(() => {
            onGetCheckoutStatus(checkout.paymentId)
                .then((result) => {
                    if (result.status === 'APPROVED') {
                        onPaymentApproved();
                    }
                })
                .catch(() => {});
        }, 3000);

        return () => clearInterval(interval);
    }, [active, method, checkout, onGetCheckoutStatus, onPaymentApproved]);

    useEffect(() => {
        if (!active || mercadoPagoConfig || publicKeyError) return;

        let cancelled = false;
        onGetMercadoPagoPublicKey?.()
            .then((result) => {
                if (!cancelled) setMercadoPagoConfig(result);
            })
            .catch(() => {
                if (!cancelled) setPublicKeyError('Nao foi possivel carregar o pagamento por cartao. Tente novamente.');
            });

        return () => { cancelled = true; };
    }, [active, mercadoPagoConfig, publicKeyError, onGetMercadoPagoPublicKey]);

    useEffect(() => {
        if (!active || method !== 'card' || cardStatus !== 'pending' || !cardPaymentId || !onGetCheckoutStatus) return;

        const interval = setInterval(() => {
            onGetCheckoutStatus(cardPaymentId)
                .then((result) => {
                    if (result.status === 'APPROVED') {
                        onPaymentApproved();
                    } else if (result.status === 'REJECTED' || result.status === 'EXPIRED') {
                        setCardStatus('rejected');
                        setCardError('Pagamento nao aprovado. Tente outro cartao.');
                    }
                })
                .catch(() => {});
        }, 3000);

        return () => clearInterval(interval);
    }, [active, method, cardStatus, cardPaymentId, onGetCheckoutStatus, onPaymentApproved]);

    const handleCardToken = useCallback((result: CardBrickTokenResult) => {
        setCardStatus('submitting');
        setCardError(null);

        onCreateCardCheckout?.(result)
            .then((response) => {
                if (response.status === 'APPROVED') {
                    onPaymentApproved();
                } else if (response.status === 'REJECTED' || response.status === 'EXPIRED') {
                    setCardStatus('rejected');
                    setCardError('Pagamento recusado. Confira os dados do cartao ou tente outro.');
                } else {
                    setCardPaymentId(response.paymentId);
                    setCardStatus('pending');
                }
            })
            .catch(() => {
                setCardStatus('rejected');
                setCardError('Nao foi possivel processar o pagamento. Tente novamente.');
            });
    }, [onCreateCardCheckout, onPaymentApproved]);

    const handleCardError = useCallback((message: string) => {
        setCardError(message);
    }, []);

    const retryCard = useCallback(() => {
        setCardStatus('idle');
        setCardError(null);
        setCardPaymentId(null);
        setBrickKey((key) => key + 1);
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.price}>
                {mercadoPagoConfig ? `R$ ${mercadoPagoConfig.amount.toFixed(2).replace('.', ',')} / mes` : 'R$ -- / mes'}
            </Text>

            <View style={styles.tabRow}>
                <Pressable
                    onPress={() => setMethod('pix')}
                    style={({ pressed }) => [styles.tabButton, method === 'pix' ? styles.tabButtonActive : null, pressed ? styles.pressed : null]}
                >
                    <Text style={[styles.tabButtonText, method === 'pix' ? styles.tabButtonTextActive : null]}>PIX</Text>
                </Pressable>
                <Pressable
                    onPress={() => setMethod('card')}
                    style={({ pressed }) => [styles.tabButton, method === 'card' ? styles.tabButtonActive : null, pressed ? styles.pressed : null]}
                >
                    <Text style={[styles.tabButtonText, method === 'card' ? styles.tabButtonTextActive : null]}>Cartao</Text>
                </Pressable>
            </View>

            {method === 'pix' ? (
                isCreating ? (
                    <View style={styles.loading}>
                        <ActivityIndicator color={colors.brand} />
                        <Text style={styles.hint}>Gerando cobranca PIX...</Text>
                    </View>
                ) : checkoutError ? (
                    <Text style={styles.error}>{checkoutError}</Text>
                ) : checkout ? (
                    <>
                        <Image source={{ uri: `data:image/png;base64,${checkout.qrCodeBase64}` }} style={styles.qrImage} />
                        <Text style={styles.hint}>Escaneie o QR code com o app do seu banco ou copie o codigo abaixo</Text>
                        <Text selectable style={styles.pixCode}>{checkout.qrCode}</Text>
                        <View style={styles.waitingRow}>
                            <ActivityIndicator color={colors.brand} size="small" />
                            <Text style={styles.hint}>Aguardando confirmacao do pagamento...</Text>
                        </View>
                    </>
                ) : null
            ) : (
                <>
                    {publicKeyError ? (
                        <Text style={styles.error}>{publicKeyError}</Text>
                    ) : !mercadoPagoConfig ? (
                        <View style={styles.loading}>
                            <ActivityIndicator color={colors.brand} />
                        </View>
                    ) : (
                        <>
                            {cardStatus !== 'rejected' ? (
                                <MercadoPagoCardBrick
                                    amount={mercadoPagoConfig.amount}
                                    key={brickKey}
                                    onError={handleCardError}
                                    onToken={handleCardToken}
                                    publicKey={mercadoPagoConfig.publicKey}
                                />
                            ) : null}
                            {cardStatus === 'submitting' ? (
                                <View style={styles.waitingRow}>
                                    <ActivityIndicator color={colors.brand} size="small" />
                                    <Text style={styles.hint}>Processando pagamento...</Text>
                                </View>
                            ) : null}
                            {cardStatus === 'pending' ? (
                                <View style={styles.waitingRow}>
                                    <ActivityIndicator color={colors.brand} size="small" />
                                    <Text style={styles.hint}>Aguardando confirmacao do pagamento...</Text>
                                </View>
                            ) : null}
                            {cardError ? <Text style={styles.error}>{cardError}</Text> : null}
                            {cardStatus === 'rejected' ? (
                                <Pressable onPress={retryCard} style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : null]}>
                                    <Text style={styles.retryButtonText}>Tentar novamente</Text>
                                </Pressable>
                            ) : null}
                        </>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: spacing[3]
    },
    price: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 20,
        fontWeight: '800'
    },
    tabRow: {
        backgroundColor: colors.canvas,
        borderRadius: 12,
        flexDirection: 'row',
        gap: spacing[1],
        padding: 4
    },
    tabButton: {
        alignItems: 'center',
        borderRadius: 9,
        flex: 1,
        paddingVertical: spacing[2]
    },
    tabButtonActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#101828',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6
    },
    tabButtonText: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
    },
    tabButtonTextActive: {
        color: colors.brandDark
    },
    loading: {
        alignItems: 'center',
        gap: spacing[2],
        paddingVertical: spacing[4]
    },
    error: {
        color: '#c0392b',
        fontFamily: fonts.sans,
        fontSize: 14
    },
    qrImage: {
        alignSelf: 'center',
        height: 220,
        width: 220
    },
    hint: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 12,
        textAlign: 'center'
    },
    pixCode: {
        backgroundColor: colors.canvas,
        borderRadius: 10,
        color: colors.text,
        fontFamily: fonts.sans,
        fontSize: 11,
        padding: spacing[2]
    },
    waitingRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center'
    },
    retryButton: {
        backgroundColor: colors.brand,
        borderRadius: radii.md,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    retryButtonText: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '800'
    },
    pressed: {
        opacity: 0.7
    }
});

import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Crown, PartyPopper, Sparkles, X } from 'lucide-react-native';
import { colors, fonts, gradients, radii, spacing } from '@/shared/design-system';
import { PlanCheckoutFlow, type CardCheckoutResult, type CheckoutStatus, type PixCheckout } from '@/modules/academic/presentation/views/components/plan-checkout';
import type { CreateCardCheckoutRequest } from '@/modules/academic/domain/repositories/ecampus-repository';

type BillingPlan = { plan: 'FREE' | 'PAID'; planExpiresAt: string | null };
type Step = 'overview' | 'checkout' | 'success';

const FREE_FEATURES = [
    '6 mensagens por dia com a IA',
    'Notas, horários e plano de ensino',
    'Dashboard completo da vida acadêmica'
];

const PAID_FEATURES = [
    '100 mensagens por dia com a IA',
    'Respostas mais rápidas, sem fila',
    'Tudo do plano Free, sem limites'
];

export function PlanModal({
    onClose,
    onCreateCardCheckout,
    onCreatePixCheckout,
    onGetBillingPlan,
    onGetCheckoutStatus,
    onGetMercadoPagoPublicKey,
    visible
}: {
    onClose: () => void;
    onCreateCardCheckout?: (input: CreateCardCheckoutRequest) => Promise<CardCheckoutResult>;
    onCreatePixCheckout?: () => Promise<PixCheckout>;
    onGetBillingPlan?: () => Promise<BillingPlan>;
    onGetCheckoutStatus?: (paymentId: string) => Promise<CheckoutStatus>;
    onGetMercadoPagoPublicKey?: () => Promise<{ publicKey: string; amount: number }>;
    visible: boolean;
}) {
    const [step, setStep] = useState<Step>('overview');
    const [billingPlan, setBillingPlan] = useState<BillingPlan | null>(null);
    const [isLoadingPlan, setIsLoadingPlan] = useState(false);
    const [planError, setPlanError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) {
            setStep('overview');
            return;
        }

        let cancelled = false;
        setIsLoadingPlan(true);
        setPlanError(null);

        onGetBillingPlan?.()
            .then((result) => {
                if (!cancelled) setBillingPlan(result);
            })
            .catch(() => {
                if (!cancelled) setPlanError('Nao foi possivel carregar seu plano agora.');
            })
            .finally(() => {
                if (!cancelled) setIsLoadingPlan(false);
            });

        return () => { cancelled = true; };
    }, [visible, onGetBillingPlan]);

    const handlePaymentApproved = () => {
        setBillingPlan((current) => (current ? { ...current, plan: 'PAID' } : { plan: 'PAID', planExpiresAt: null }));
        setStep('success');
    };

    const isPaid = billingPlan?.plan === 'PAID';
    const expiresAt = billingPlan?.planExpiresAt ? new Date(billingPlan.planExpiresAt) : null;

    return (
        <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{step === 'checkout' ? 'Assinar Meu Campus Pro' : 'Seu plano'}</Text>
                        <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}>
                            <X color={colors.textMuted} size={18} />
                        </Pressable>
                    </View>

                    {isLoadingPlan ? (
                        <View style={styles.loadingBlock}>
                            <ActivityIndicator color={colors.brand} />
                        </View>
                    ) : planError ? (
                        <Text style={styles.errorText}>{planError}</Text>
                    ) : step === 'success' ? (
                        <SuccessView onDone={onClose} />
                    ) : step === 'checkout' ? (
                        <>
                            <PlanCheckoutFlow
                                active={step === 'checkout'}
                                onCreateCardCheckout={onCreateCardCheckout}
                                onCreatePixCheckout={onCreatePixCheckout}
                                onGetCheckoutStatus={onGetCheckoutStatus}
                                onGetMercadoPagoPublicKey={onGetMercadoPagoPublicKey}
                                onPaymentApproved={handlePaymentApproved}
                            />
                            <Pressable onPress={() => setStep('overview')} style={({ pressed }) => [styles.backLink, pressed ? styles.pressed : null]}>
                                <Text style={styles.backLinkText}>Voltar</Text>
                            </Pressable>
                        </>
                    ) : (
                        <PlanOverview
                            expiresAt={expiresAt}
                            isPaid={isPaid}
                            onUpgrade={() => setStep('checkout')}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

function PlanOverview({ expiresAt, isPaid, onUpgrade }: { expiresAt: Date | null; isPaid: boolean; onUpgrade: () => void }) {
    return (
        <View style={styles.overviewStack}>
            <View style={styles.currentBadgeRow}>
                <View style={[styles.currentBadge, isPaid ? styles.currentBadgePro : styles.currentBadgeFree]}>
                    {isPaid ? <Crown color="#6e4f00" size={14} /> : null}
                    <Text style={[styles.currentBadgeText, isPaid ? styles.currentBadgeTextPro : styles.currentBadgeTextFree]}>
                        {isPaid ? 'Plano Pro ativo' : 'Voce esta no plano Free'}
                    </Text>
                </View>
            </View>

            {isPaid && expiresAt ? (
                <Text style={styles.expiresText}>Renova em {expiresAt.toLocaleDateString('pt-BR')}</Text>
            ) : null}

            <View style={styles.planCard}>
                <View style={styles.planCardHeader}>
                    <Text style={styles.planCardTitle}>Free</Text>
                    <Text style={styles.planCardPrice}>R$ 0</Text>
                </View>
                <FeatureList features={FREE_FEATURES} tone="neutral" />
                {!isPaid ? <View style={styles.currentPill}><Text style={styles.currentPillText}>Seu plano atual</Text></View> : null}
            </View>

            <View style={styles.planCardPro}>
                <Sparkles color="rgba(255,255,255,0.14)" size={110} style={styles.planCardProGlow} />
                <View style={styles.planCardHeader}>
                    <View style={styles.planCardProTitleRow}>
                        <Crown color="#febf31" size={18} />
                        <Text style={styles.planCardTitlePro}>Pro</Text>
                    </View>
                    <Text style={styles.planCardPricePro}>R$ 20<Text style={styles.planCardPricePeriod}>/mes</Text></Text>
                </View>
                <FeatureList features={PAID_FEATURES} tone="pro" />
                {isPaid ? (
                    <View style={styles.currentPillPro}><Text style={styles.currentPillProText}>Seu plano atual</Text></View>
                ) : (
                    <Pressable onPress={onUpgrade} style={({ pressed }) => [styles.upgradeButton, pressed ? styles.pressed : null]}>
                        <Text style={styles.upgradeButtonText}>Assinar agora</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

function FeatureList({ features, tone }: { features: string[]; tone: 'neutral' | 'pro' }) {
    return (
        <View style={styles.featureList}>
            {features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                    <CheckCircle2 color={tone === 'pro' ? '#febf31' : colors.brand} size={16} />
                    <Text style={[styles.featureText, tone === 'pro' ? styles.featureTextPro : null]}>{feature}</Text>
                </View>
            ))}
        </View>
    );
}

function SuccessView({ onDone }: { onDone: () => void }) {
    return (
        <View style={styles.successStack}>
            <LinearGradient colors={gradients.brand} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.successBadge}>
                <PartyPopper color={colors.inverseText} size={32} />
            </LinearGradient>
            <Text style={styles.successTitle}>Voce agora e Pro!</Text>
            <Text style={styles.successText}>100 mensagens por dia com a IA liberadas. Aproveite.</Text>
            <Pressable onPress={onDone} style={({ pressed }) => [styles.upgradeButton, pressed ? styles.pressed : null]}>
                <Text style={styles.upgradeButtonText}>Show de bola</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(11, 61, 50, 0.55)',
        flex: 1,
        justifyContent: 'center',
        padding: spacing[4]
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: radii.md + 8,
        gap: spacing[3],
        maxHeight: '88%',
        maxWidth: 400,
        padding: spacing[5],
        width: '100%'
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    headerTitle: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 18,
        fontWeight: '800'
    },
    closeButton: {
        alignItems: 'center',
        height: 28,
        justifyContent: 'center',
        width: 28
    },
    loadingBlock: {
        alignItems: 'center',
        paddingVertical: spacing[6]
    },
    errorText: {
        color: '#c0392b',
        fontFamily: fonts.sans,
        fontSize: 14
    },
    overviewStack: {
        gap: spacing[3]
    },
    currentBadgeRow: {
        alignItems: 'flex-start'
    },
    currentBadge: {
        alignItems: 'center',
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: spacing[3],
        paddingVertical: 6
    },
    currentBadgeFree: {
        backgroundColor: colors.brandSubtle
    },
    currentBadgePro: {
        backgroundColor: '#fff4d7'
    },
    currentBadgeText: {
        fontFamily: fonts.medium,
        fontSize: 12,
        fontWeight: '800'
    },
    currentBadgeTextFree: {
        color: colors.brandDark
    },
    currentBadgeTextPro: {
        color: '#6e4f00'
    },
    expiresText: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 12
    },
    planCard: {
        backgroundColor: colors.surfaceSubtle,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[3],
        padding: spacing[4]
    },
    planCardHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    planCardTitle: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 16,
        fontWeight: '800'
    },
    planCardPrice: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 16,
        fontWeight: '800'
    },
    currentPill: {
        alignItems: 'center',
        backgroundColor: colors.border,
        borderRadius: radii.pill,
        paddingVertical: 8
    },
    currentPillText: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 12.5,
        fontWeight: '800'
    },
    planCardPro: {
        backgroundColor: colors.brandDark,
        borderRadius: radii.md,
        gap: spacing[3],
        overflow: 'hidden',
        padding: spacing[4],
        position: 'relative'
    },
    planCardProGlow: {
        position: 'absolute',
        right: -20,
        top: -30
    },
    planCardProTitleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6
    },
    planCardTitlePro: {
        color: '#ffffff',
        fontFamily: fonts.medium,
        fontSize: 16,
        fontWeight: '800'
    },
    planCardPricePro: {
        color: '#febf31',
        fontFamily: fonts.medium,
        fontSize: 18,
        fontWeight: '800'
    },
    planCardPricePeriod: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600'
    },
    featureList: {
        gap: spacing[2]
    },
    featureRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2]
    },
    featureText: {
        color: colors.text,
        flex: 1,
        fontFamily: fonts.sans,
        fontSize: 13.5
    },
    featureTextPro: {
        color: 'rgba(255,255,255,0.92)'
    },
    upgradeButton: {
        alignItems: 'center',
        backgroundColor: '#febf31',
        borderRadius: radii.md,
        justifyContent: 'center',
        minHeight: 46,
        paddingHorizontal: spacing[4]
    },
    upgradeButtonText: {
        color: '#3a2900',
        fontFamily: fonts.medium,
        fontSize: 14.5,
        fontWeight: '800'
    },
    currentPillPro: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderRadius: radii.pill,
        paddingVertical: 8
    },
    currentPillProText: {
        color: '#ffffff',
        fontFamily: fonts.medium,
        fontSize: 12.5,
        fontWeight: '800'
    },
    backLink: {
        alignItems: 'center',
        paddingVertical: spacing[2]
    },
    backLinkText: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
    },
    successStack: {
        alignItems: 'center',
        gap: spacing[2],
        paddingVertical: spacing[3]
    },
    successBadge: {
        alignItems: 'center',
        borderRadius: radii.pill,
        height: 72,
        justifyContent: 'center',
        marginBottom: spacing[2],
        width: 72
    },
    successTitle: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 19,
        fontWeight: '800'
    },
    successText: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 13.5,
        marginBottom: spacing[3],
        textAlign: 'center'
    },
    pressed: {
        opacity: 0.7
    }
});

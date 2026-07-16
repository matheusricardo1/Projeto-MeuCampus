import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRootNavigationState, useRouter } from 'expo-router';
import { Activity, Bell, BellRing, Check, Coins, CreditCard, LogOut, ShieldCheck, TrendingUp, Users, Wallet, X } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '@/shared/design-system';
import { SkeletonBlock } from '@/modules/academic/presentation/views/components';
import { AdminUnauthorizedError, connectAdminLiveUsers, fetchAdminMetrics, fetchAiUsageToday, fetchPendingCommunityPosts, moderateCommunityPost, type AdminMetrics, type AiUsageToday, type PendingCommunityPost } from '@/modules/admin/infrastructure/admin-api';
import { clearAdminToken, getAdminToken } from '@/modules/admin/infrastructure/admin-token-store';
import { disableOwnerPushNotifications, enableOwnerPushNotifications, getPushSubscriptionState, type PushSubscriptionState } from '@/modules/admin/infrastructure/push-subscription';
import { AiUsageChart } from '@/modules/admin/presentation/components/ai-usage-chart';

function formatBRL(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatTokens(count: number): string {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
    return String(count);
}

export function AdminDashboardPage() {
    const router = useRouter();
    // expo-router throws if router.replace() runs before the Root Layout's
    // navigator has mounted — this hook's key stays undefined until then, so
    // gating the initial redirect-if-no-token check on it avoids the race.
    const rootNavigationState = useRootNavigationState();
    const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
    const [aiUsageToday, setAiUsageToday] = useState<AiUsageToday | null>(null);
    const [pendingPosts, setPendingPosts] = useState<PendingCommunityPost[]>([]);
    const [moderatingId, setModeratingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pushState, setPushState] = useState<PushSubscriptionState>('unsupported');
    const [isTogglingPush, setIsTogglingPush] = useState(false);
    const disconnectRef = useRef<(() => void) | null>(null);

    const logout = useCallback(() => {
        disconnectRef.current?.();
        clearAdminToken();
        router.replace('/admin/login');
    }, [router]);

    const load = useCallback(async () => {
        const token = getAdminToken();
        if (!token) {
            router.replace('/admin/login');
            return;
        }

        try {
            const [metricsData, usageData, pendingData] = await Promise.all([
                fetchAdminMetrics(token),
                fetchAiUsageToday(token),
                fetchPendingCommunityPosts(token)
            ]);
            setMetrics(metricsData);
            setAiUsageToday(usageData);
            setPendingPosts(pendingData);
            setError(null);
        } catch (fetchError) {
            if (fetchError instanceof AdminUnauthorizedError) {
                logout();
                return;
            }
            setError('Nao foi possivel carregar as metricas agora.');
        }
    }, [logout, router]);

    useEffect(() => {
        if (!rootNavigationState?.key) return;
        void load();
    }, [rootNavigationState?.key, load]);

    useEffect(() => {
        const token = getAdminToken();
        if (!token) return undefined;

        disconnectRef.current = connectAdminLiveUsers(token, (count) => {
            setMetrics((current) => (current ? { ...current, liveUsers: count } : current));
        });

        return () => disconnectRef.current?.();
    }, []);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        void getPushSubscriptionState().then(setPushState);
    }, []);

    const togglePushNotifications = useCallback(async () => {
        const token = getAdminToken();
        if (!token || isTogglingPush) return;

        setIsTogglingPush(true);
        try {
            const nextState = pushState === 'subscribed'
                ? await disableOwnerPushNotifications(token)
                : await enableOwnerPushNotifications(token);
            setPushState(nextState);
        } catch (toggleError) {
            if (toggleError instanceof AdminUnauthorizedError) {
                logout();
                return;
            }
        } finally {
            setIsTogglingPush(false);
        }
    }, [isTogglingPush, logout, pushState]);

    const moderate = useCallback(async (id: string, action: 'approve' | 'reject') => {
        const token = getAdminToken();
        if (!token || moderatingId) return;

        setModeratingId(id);
        try {
            await moderateCommunityPost(token, id, action);
            setPendingPosts((current) => current.filter((post) => post.id !== id));
        } catch (moderateError) {
            if (moderateError instanceof AdminUnauthorizedError) {
                logout();
                return;
            }
        } finally {
            setModeratingId(null);
        }
    }, [logout, moderatingId]);

    if (error) {
        return (
            <View style={styles.screen}>
                <View style={styles.errorCard}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryButton, pressed ? styles.pressedFeedback : null]}>
                        <Text style={styles.retryButtonText}>Tentar novamente</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Painel do dono</Text>
                    <Text style={styles.subtitle}>Metricas de uso, plano pago e custo de IA</Text>
                </View>
                <View style={styles.headerActions}>
                    {pushState !== 'unsupported' ? (
                        <Pressable
                            disabled={isTogglingPush}
                            onPress={() => void togglePushNotifications()}
                            style={({ pressed }) => [
                                styles.logoutButton,
                                pushState === 'subscribed' ? styles.notifyButtonActive : null,
                                pressed ? styles.pressedFeedback : null
                            ]}
                        >
                            {pushState === 'subscribed'
                                ? <BellRing color={colors.brand} size={16} />
                                : <Bell color={colors.textMuted} size={16} />}
                        </Pressable>
                    ) : null}
                    <Pressable onPress={logout} style={({ pressed }) => [styles.logoutButton, pressed ? styles.pressedFeedback : null]}>
                        <LogOut color={colors.textMuted} size={16} />
                    </Pressable>
                </View>
            </View>

            {!metrics ? (
                <View style={styles.grid}>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                        <SkeletonBlock height={110} key={index} style={{ flexBasis: '47%', flexGrow: 1 }} />
                    ))}
                </View>
            ) : (
                <>
                    <View style={styles.grid}>
                        <MetricCard
                            icon={<Activity color={colors.brand} size={18} />}
                            label="Usuarios ao vivo"
                            live
                            value={String(metrics.liveUsers)}
                        />
                        <MetricCard
                            icon={<Users color={colors.brand} size={18} />}
                            label="Plano pago"
                            value={String(metrics.paidUsers)}
                        />
                        <MetricCard
                            hint={`Total: ${formatBRL(metrics.revenueCents.total)}`}
                            icon={<Wallet color={colors.brand} size={18} />}
                            label="Faturamento (mes)"
                            value={formatBRL(metrics.revenueCents.thisMonth)}
                        />
                        <MetricCard
                            hint={`${formatTokens(metrics.aiUsage.inputTokens)} in / ${formatTokens(metrics.aiUsage.outputTokens)} out`}
                            icon={<Coins color={colors.warning} size={18} />}
                            label="Tokens de IA"
                            value={formatTokens(metrics.aiUsage.inputTokens + metrics.aiUsage.outputTokens)}
                        />
                        <MetricCard
                            icon={<CreditCard color={colors.danger} size={18} />}
                            label="Custo de IA"
                            value={formatBRL(metrics.aiUsage.costCents)}
                        />
                        <MetricCard
                            icon={<TrendingUp color={metrics.profitCents >= 0 ? colors.success : colors.danger} size={18} />}
                            label="Lucro estimado"
                            value={formatBRL(metrics.profitCents)}
                            valueColor={metrics.profitCents >= 0 ? colors.success : colors.danger}
                        />
                    </View>

                    {aiUsageToday ? <AiUsageChart usage={aiUsageToday} /> : null}

                    <View style={styles.moderationHeaderRow}>
                        <ShieldCheck color={colors.brand} size={18} />
                        <Text style={styles.moderationTitle}>Moderação da Comunidade</Text>
                        {pendingPosts.length > 0 ? (
                            <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{pendingPosts.length}</Text></View>
                        ) : null}
                    </View>
                    {pendingPosts.length === 0 ? (
                        <View style={styles.moderationEmpty}>
                            <Text style={styles.moderationEmptyText}>Nenhum anúncio aguardando aprovação.</Text>
                        </View>
                    ) : (
                        <View style={styles.moderationList}>
                            {pendingPosts.map((post) => (
                                <PendingCard key={post.id} post={post} busy={moderatingId === post.id} onModerate={(action) => void moderate(post.id, action)} />
                            ))}
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    );
}

function PendingCard({ post, busy, onModerate }: { post: PendingCommunityPost; busy: boolean; onModerate: (action: 'approve' | 'reject') => void }) {
    const details = Object.entries(post.payload ?? {})
        .filter(([key, val]) => key !== 'titulo' && key !== 'descricao' && typeof val === 'string' && val.length > 0)
        .map(([key, val]) => `${key}: ${String(val)}`);
    const description = typeof post.payload?.descricao === 'string' ? post.payload.descricao : null;

    return (
        <View style={styles.pendingCard}>
            <View style={styles.pendingTopRow}>
                <Text style={styles.pendingCategory}>{post.category}</Text>
                <Text style={styles.pendingAuthor}>{post.authorName}</Text>
            </View>
            <Text style={styles.pendingBody}>{post.body}</Text>
            {details.length > 0 ? <Text style={styles.pendingDetails}>{details.join('  ·  ')}</Text> : null}
            {description ? <Text style={styles.pendingDescription}>{description}</Text> : null}
            <View style={styles.pendingActions}>
                <Pressable disabled={busy} onPress={() => onModerate('reject')} style={({ pressed }) => [styles.rejectButton, pressed ? styles.pressedFeedback : null, busy ? styles.pressedFeedback : null]}>
                    <X color={colors.danger} size={16} />
                    <Text style={styles.rejectText}>Rejeitar</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={() => onModerate('approve')} style={({ pressed }) => [styles.approveButton, pressed ? styles.pressedFeedback : null, busy ? styles.pressedFeedback : null]}>
                    <Check color={colors.inverseText} size={16} />
                    <Text style={styles.approveText}>Aprovar</Text>
                </Pressable>
            </View>
        </View>
    );
}

function MetricCard({ hint, icon, label, live, value, valueColor }: { hint?: string; icon: ReactNode; label: string; live?: boolean; value: string; valueColor?: string }) {
    return (
        <View style={styles.card}>
            <View style={styles.cardTopRow}>
                <View style={styles.cardIcon}>{icon}</View>
                {live ? (
                    <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveBadgeText}>AO VIVO</Text>
                    </View>
                ) : null}
            </View>
            <Text style={styles.cardLabel}>{label}</Text>
            <Text style={[styles.cardValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
            {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.canvas,
        flex: 1
    },
    content: {
        gap: spacing[5],
        maxWidth: 900,
        padding: spacing[5],
        width: '100%',
        alignSelf: 'center'
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    title: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 24,
        fontWeight: '800'
    },
    subtitle: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 13,
        marginTop: 2
    },
    headerActions: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2]
    },
    logoutButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radii.pill,
        height: 40,
        justifyContent: 'center',
        width: 40
    },
    notifyButtonActive: {
        backgroundColor: colors.brandSubtle
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[3]
    },
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        flexBasis: '47%',
        flexGrow: 1,
        gap: spacing[1],
        minWidth: 220,
        padding: spacing[4]
    },
    cardTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    cardIcon: {
        alignItems: 'center',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.pill,
        height: 34,
        justifyContent: 'center',
        width: 34
    },
    liveBadge: {
        alignItems: 'center',
        backgroundColor: colors.successSubtle,
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3
    },
    liveDot: {
        backgroundColor: colors.success,
        borderRadius: radii.pill,
        height: 6,
        width: 6
    },
    liveBadgeText: {
        color: colors.success,
        fontFamily: fonts.medium,
        fontSize: 9.5,
        fontWeight: '800'
    },
    cardLabel: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 11.5,
        fontWeight: '800',
        marginTop: spacing[2],
        textTransform: 'uppercase'
    },
    cardValue: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 26,
        fontWeight: '800'
    },
    cardHint: {
        color: colors.textSubtle,
        fontFamily: fonts.sans,
        fontSize: 11.5
    },
    errorCard: {
        alignItems: 'center',
        alignSelf: 'center',
        gap: spacing[3],
        marginTop: 120,
        maxWidth: 320
    },
    errorText: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 14,
        textAlign: 'center'
    },
    retryButton: {
        backgroundColor: colors.brand,
        borderRadius: radii.md,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    retryButtonText: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '800'
    },
    pressedFeedback: {
        opacity: 0.7
    },
    moderationHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2],
        marginTop: spacing[2]
    },
    moderationTitle: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 17,
        fontWeight: '800'
    },
    pendingBadge: {
        alignItems: 'center',
        backgroundColor: colors.warning,
        borderRadius: radii.pill,
        justifyContent: 'center',
        minWidth: 22,
        paddingHorizontal: 7,
        paddingVertical: 2
    },
    pendingBadgeText: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 12,
        fontWeight: '800'
    },
    moderationEmpty: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        padding: spacing[4]
    },
    moderationEmptyText: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 13,
        textAlign: 'center'
    },
    moderationList: {
        gap: spacing[3]
    },
    pendingCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[2],
        padding: spacing[4]
    },
    pendingTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    pendingCategory: {
        color: colors.brand,
        fontFamily: fonts.medium,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    pendingAuthor: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 12
    },
    pendingBody: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '700'
    },
    pendingDetails: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 12.5
    },
    pendingDescription: {
        color: colors.text,
        fontFamily: fonts.sans,
        fontSize: 13
    },
    pendingActions: {
        flexDirection: 'row',
        gap: spacing[2],
        marginTop: spacing[1]
    },
    rejectButton: {
        alignItems: 'center',
        backgroundColor: colors.dangerSubtle,
        borderColor: colors.dangerBorder,
        borderRadius: radii.md,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        paddingVertical: spacing[3]
    },
    rejectText: {
        color: colors.danger,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '800'
    },
    approveButton: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.md,
        flex: 1,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        paddingVertical: spacing[3]
    },
    approveText: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '800'
    }
});

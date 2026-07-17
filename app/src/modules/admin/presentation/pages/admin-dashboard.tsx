import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRootNavigationState, useRouter } from 'expo-router';
import { Activity, Bell, BellRing, Check, Coins, CreditCard, Database, Eye, EyeOff, LogOut, Plus, ShieldCheck, Trash2, TrendingUp, Users, Wallet, X } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '@/shared/design-system';
import { SkeletonBlock } from '@/modules/academic/presentation/views/components';
import { AdminUnauthorizedError, connectAdminLiveUsers, createGlobalData, deleteGlobalData, fetchAdminMetrics, fetchAiUsageToday, fetchGlobalData, fetchPendingCommunityPosts, moderateCommunityPost, setGlobalDataActive, type AdminMetrics, type AiUsageToday, type GlobalDataItem, type GlobalDataType, type PendingCommunityPost } from '@/modules/admin/infrastructure/admin-api';
import { GLOBAL_DATA_TYPE_SPECS, getGlobalDataSpec } from '@/modules/admin/domain/global-data-catalog';
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

            <GlobalDataSection onUnauthorized={logout} />
        </ScrollView>
    );
}

// ============================================ Global data (official AI source)

function GlobalDataSection({ onUnauthorized }: { onUnauthorized: () => void }) {
    const [items, setItems] = useState<GlobalDataItem[]>([]);
    const [type, setType] = useState<GlobalDataType>('ACADEMIC_CALENDAR');
    const [title, setTitle] = useState('');
    const [values, setValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const spec = getGlobalDataSpec(type);

    const load = useCallback(async () => {
        const token = getAdminToken();
        if (!token) return;
        try {
            setItems(await fetchGlobalData(token));
        } catch (error) {
            if (error instanceof AdminUnauthorizedError) onUnauthorized();
        }
    }, [onUnauthorized]);

    useEffect(() => { void load(); }, [load]);

    const selectType = (next: GlobalDataType) => {
        setType(next);
        setTitle('');
        setValues({});
        setFormError(null);
    };

    const submit = async () => {
        const token = getAdminToken();
        if (!token || saving) return;

        const cleanTitle = title.trim();
        if (!cleanTitle) { setFormError('Preencha o título.'); return; }
        const missing = spec.fields.find((field) => field.required && !(values[field.key] ?? '').trim());
        if (missing) { setFormError(`Preencha: ${missing.label}.`); return; }

        const payload: Record<string, string> = {};
        for (const field of spec.fields) {
            const raw = (values[field.key] ?? '').trim();
            if (raw) payload[field.key] = raw;
        }

        setSaving(true);
        setFormError(null);
        try {
            const created = await createGlobalData(token, { type, title: cleanTitle, payload });
            setItems((current) => [created, ...current]);
            setTitle('');
            setValues({});
        } catch (error) {
            if (error instanceof AdminUnauthorizedError) { onUnauthorized(); return; }
            setFormError('Não foi possível salvar agora.');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (item: GlobalDataItem) => {
        const token = getAdminToken();
        if (!token || busyId) return;
        setBusyId(item.id);
        try {
            await setGlobalDataActive(token, item.id, !item.active);
            setItems((current) => current.map((it) => (it.id === item.id ? { ...it, active: !it.active } : it)));
        } catch (error) {
            if (error instanceof AdminUnauthorizedError) onUnauthorized();
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (item: GlobalDataItem) => {
        const token = getAdminToken();
        if (!token || busyId) return;
        setBusyId(item.id);
        try {
            await deleteGlobalData(token, item.id);
            setItems((current) => current.filter((it) => it.id !== item.id));
        } catch (error) {
            if (error instanceof AdminUnauthorizedError) onUnauthorized();
        } finally {
            setBusyId(null);
        }
    };

    return (
        <View style={styles.globalSection}>
            <View style={styles.moderationHeaderRow}>
                <Database color={colors.brand} size={18} />
                <Text style={styles.moderationTitle}>Dados globais (fonte oficial da IA)</Text>
            </View>
            <Text style={styles.globalHint}>Dados oficiais que mudam pouco no ano. A IA trata como fato (diferente dos relatos da Comunidade).</Text>

            {/* Type selector */}
            <View style={styles.globalTypeRow}>
                {GLOBAL_DATA_TYPE_SPECS.map((option) => {
                    const active = option.type === type;
                    return (
                        <Pressable key={option.type} onPress={() => selectType(option.type)} style={({ pressed }) => [styles.globalTypeChip, active ? styles.globalTypeChipActive : null, pressed ? styles.pressedFeedback : null]}>
                            <Text style={[styles.globalTypeChipText, active ? styles.globalTypeChipTextActive : null]}>{option.emoji}  {option.label}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Form */}
            <View style={styles.globalForm}>
                <Text style={styles.globalFieldLabel}>{spec.titleLabel} *</Text>
                <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={spec.titlePlaceholder}
                    placeholderTextColor={colors.textSubtle}
                    style={styles.globalInput}
                    maxLength={200}
                />
                {spec.fields.map((field) => (
                    <View key={field.key}>
                        <Text style={styles.globalFieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
                        <TextInput
                            value={values[field.key] ?? ''}
                            onChangeText={(val) => setValues((current) => ({ ...current, [field.key]: val }))}
                            placeholder={field.placeholder ?? field.label}
                            placeholderTextColor={colors.textSubtle}
                            style={[styles.globalInput, field.multiline ? styles.globalInputMultiline : null]}
                            multiline={field.multiline}
                            maxLength={field.multiline ? 1000 : 200}
                        />
                    </View>
                ))}
                {formError ? <Text style={styles.globalError}>{formError}</Text> : null}
                <Pressable disabled={saving} onPress={() => void submit()} style={({ pressed }) => [styles.globalSubmit, pressed ? styles.pressedFeedback : null, saving ? styles.pressedFeedback : null]}>
                    <Plus color={colors.inverseText} size={16} />
                    <Text style={styles.globalSubmitText}>{saving ? 'Salvando...' : 'Adicionar dado oficial'}</Text>
                </Pressable>
            </View>

            {/* Existing items */}
            {items.length === 0 ? (
                <View style={styles.moderationEmpty}>
                    <Text style={styles.moderationEmptyText}>Nenhum dado oficial cadastrado ainda.</Text>
                </View>
            ) : (
                <View style={styles.moderationList}>
                    {items.map((item) => {
                        const itemSpec = getGlobalDataSpec(item.type);
                        const details = Object.entries(item.payload ?? {})
                            .filter(([, val]) => typeof val === 'string' && val.length > 0)
                            .map(([key, val]) => String(val));
                        return (
                            <View key={item.id} style={[styles.globalItem, !item.active ? styles.globalItemInactive : null]}>
                                <View style={styles.globalItemHeader}>
                                    <Text style={styles.globalItemType}>{itemSpec.emoji} {itemSpec.label}</Text>
                                    {!item.active ? <Text style={styles.globalInactiveTag}>oculto</Text> : null}
                                </View>
                                <Text style={styles.globalItemTitle}>{item.title}</Text>
                                {details.length > 0 ? <Text style={styles.globalItemDetails}>{details.join('  ·  ')}</Text> : null}
                                <View style={styles.globalItemActions}>
                                    <Pressable disabled={busyId === item.id} onPress={() => void toggleActive(item)} style={({ pressed }) => [styles.globalItemButton, pressed ? styles.pressedFeedback : null]}>
                                        {item.active ? <EyeOff color={colors.textMuted} size={15} /> : <Eye color={colors.brand} size={15} />}
                                        <Text style={styles.globalItemButtonText}>{item.active ? 'Ocultar' : 'Exibir'}</Text>
                                    </Pressable>
                                    <Pressable disabled={busyId === item.id} onPress={() => void remove(item)} style={({ pressed }) => [styles.globalItemButton, pressed ? styles.pressedFeedback : null]}>
                                        <Trash2 color={colors.danger} size={15} />
                                        <Text style={[styles.globalItemButtonText, { color: colors.danger }]}>Excluir</Text>
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
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
    },
    // Global data section
    globalSection: {
        gap: spacing[3],
        marginTop: spacing[2]
    },
    globalHint: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 12.5,
        marginTop: -spacing[1]
    },
    globalTypeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2]
    },
    globalTypeChip: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    globalTypeChipActive: {
        backgroundColor: colors.brand,
        borderColor: colors.brand
    },
    globalTypeChipText: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 12.5,
        fontWeight: '800'
    },
    globalTypeChipTextActive: {
        color: colors.inverseText
    },
    globalForm: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[2],
        padding: spacing[4]
    },
    globalFieldLabel: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 12.5,
        fontWeight: '700'
    },
    globalInput: {
        backgroundColor: colors.canvas,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        borderWidth: 1,
        color: colors.text,
        fontFamily: fonts.sans,
        fontSize: 14,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    globalInputMultiline: {
        minHeight: 72,
        textAlignVertical: 'top'
    },
    globalError: {
        color: colors.danger,
        fontFamily: fonts.sans,
        fontSize: 12.5
    },
    globalSubmit: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        marginTop: spacing[1],
        paddingVertical: spacing[3]
    },
    globalSubmitText: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '800'
    },
    globalItem: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[1],
        padding: spacing[4]
    },
    globalItemInactive: {
        opacity: 0.6
    },
    globalItemHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'space-between'
    },
    globalItemType: {
        color: colors.brand,
        fontFamily: fonts.medium,
        fontSize: 11.5,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    globalInactiveTag: {
        color: colors.textSubtle,
        fontFamily: fonts.medium,
        fontSize: 11,
        fontWeight: '700'
    },
    globalItemTitle: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '700'
    },
    globalItemDetails: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 12.5
    },
    globalItemActions: {
        flexDirection: 'row',
        gap: spacing[2],
        marginTop: spacing[2]
    },
    globalItemButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceSubtle,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[1],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    globalItemButtonText: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 12.5,
        fontWeight: '700'
    }
});

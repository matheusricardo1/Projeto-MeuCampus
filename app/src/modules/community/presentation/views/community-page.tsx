import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Info, Megaphone, Users, Utensils, Zap } from 'lucide-react-native';
import { AppText, colors, radii, shadows, spacing, textShadows, typography } from '@/shared/design-system';
import { hapticTap } from '@/shared/haptics';
import { useCommunity } from '@/modules/community/presentation/hooks/use-community';
import type { CommunityCategory, CommunityPost, RuLevel } from '@/modules/community/domain/community-post';

const CATEGORY_TABS: Array<{ id: CommunityCategory; label: string; icon: typeof Utensils }> = [
    { id: 'FILA_RU', label: 'Fila do RU', icon: Utensils },
    { id: 'BOLSA', label: 'Bolsa', icon: Megaphone },
    { id: 'ENERGIA', label: 'Energia', icon: Zap }
];

const RU_OPTIONS: Array<{ level: RuLevel; label: string; body: string }> = [
    { level: 'empty', label: 'Vazio', body: 'RU está vazio agora' },
    { level: 'moderate', label: 'Moderado', body: 'RU com movimento moderado' },
    { level: 'full', label: 'Lotado', body: 'RU está lotado agora' }
];

const RU_LEVEL_LABEL: Record<RuLevel, string> = {
    empty: 'Vazio',
    moderate: 'Moderado',
    full: 'Lotado'
};

export function CommunityPage({ authorName }: { authorName: string }) {
    const community = useCommunity('FILA_RU');

    return (
        <View style={styles.container}>
            <View style={styles.disclaimerCard}>
                <Info color={colors.brand} size={18} />
                <Text style={styles.disclaimerText}>
                    Mural colaborativo dos alunos. São relatos em tempo real, não informações oficiais da UFAM — confirme quando puder ajudar a comunidade.
                </Text>
            </View>

            <View style={styles.categoryRow}>
                {CATEGORY_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = community.category === tab.id;
                    return (
                        <Pressable
                            key={tab.id}
                            onPress={() => { hapticTap(); community.setCategory(tab.id); }}
                            style={({ pressed }) => [styles.categoryTab, active ? styles.categoryTabActive : null, pressed ? styles.pressed : null]}
                        >
                            <Icon color={active ? colors.inverseText : colors.brand} size={16} />
                            <Text style={[styles.categoryTabText, active ? styles.categoryTabTextActive : null]}>{tab.label}</Text>
                        </Pressable>
                    );
                })}
            </View>

            <Composer category={community.category} isPosting={community.isPosting} authorName={authorName} onSubmit={community.createPost} />

            {community.error ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{community.error}</Text>
                </View>
            ) : null}

            {community.isLoading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={colors.brand} />
                </View>
            ) : community.posts.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Users color={colors.textSubtle} size={28} />
                    <Text style={styles.emptyText}>Nenhum relato recente. Seja o primeiro a compartilhar com a comunidade.</Text>
                </View>
            ) : (
                <View style={styles.feed}>
                    {community.posts.map((post) => (
                        <PostCard key={post.id} post={post} onConfirm={() => community.confirmPost(post.id)} />
                    ))}
                </View>
            )}
        </View>
    );
}

function Composer({
    category,
    isPosting,
    authorName,
    onSubmit
}: {
    category: CommunityCategory;
    isPosting: boolean;
    authorName: string;
    onSubmit: (input: { body: string; authorName: string; payload?: Record<string, unknown> | null }) => Promise<void>;
}) {
    const [scholarship, setScholarship] = useState('');
    const [location, setLocation] = useState('');

    const submit = async (body: string, payload: Record<string, unknown>) => {
        hapticTap();
        try {
            await onSubmit({ body, authorName, payload });
            setScholarship('');
            setLocation('');
        } catch {
            // error surfaced by the hook
        }
    };

    if (category === 'FILA_RU') {
        return (
            <View style={styles.composer}>
                <Text style={styles.composerTitle}>Como está a fila do RU agora?</Text>
                <View style={styles.quickRow}>
                    {RU_OPTIONS.map((option) => (
                        <Pressable
                            key={option.level}
                            disabled={isPosting}
                            onPress={() => void submit(option.body, { level: option.level })}
                            style={({ pressed }) => [styles.quickButton, pressed ? styles.pressed : null, isPosting ? styles.disabled : null]}
                        >
                            <Text style={styles.quickButtonText}>{option.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>
        );
    }

    if (category === 'BOLSA') {
        const trimmed = scholarship.trim();
        return (
            <View style={styles.composer}>
                <Text style={styles.composerTitle}>Alguma bolsa caiu?</Text>
                <TextInput
                    value={scholarship}
                    onChangeText={setScholarship}
                    placeholder="Qual auxílio/bolsa? (ex.: PNAES, monitoria)"
                    placeholderTextColor={colors.textSubtle}
                    style={styles.input}
                    maxLength={80}
                />
                <View style={styles.quickRow}>
                    <Pressable
                        disabled={isPosting || !trimmed}
                        onPress={() => void submit(`Bolsa "${trimmed}" caiu`, { scholarship: trimmed, dropped: true })}
                        style={({ pressed }) => [styles.quickButton, styles.quickButtonPositive, pressed ? styles.pressed : null, (isPosting || !trimmed) ? styles.disabled : null]}
                    >
                        <Text style={[styles.quickButtonText, styles.quickButtonTextPositive]}>Caiu ✓</Text>
                    </Pressable>
                    <Pressable
                        disabled={isPosting || !trimmed}
                        onPress={() => void submit(`Bolsa "${trimmed}" ainda não caiu`, { scholarship: trimmed, dropped: false })}
                        style={({ pressed }) => [styles.quickButton, pressed ? styles.pressed : null, (isPosting || !trimmed) ? styles.disabled : null]}
                    >
                        <Text style={styles.quickButtonText}>Não caiu</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    const trimmedLocation = location.trim();
    return (
        <View style={styles.composer}>
            <Text style={styles.composerTitle}>Queda de energia no campus?</Text>
            <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Onde? (ex.: Bloco M, ICE, setor sul)"
                placeholderTextColor={colors.textSubtle}
                style={styles.input}
                maxLength={80}
            />
            <View style={styles.quickRow}>
                <Pressable
                    disabled={isPosting || !trimmedLocation}
                    onPress={() => void submit(`Sem energia em ${trimmedLocation}`, { location: trimmedLocation, hasPower: false })}
                    style={({ pressed }) => [styles.quickButton, styles.quickButtonNegative, pressed ? styles.pressed : null, (isPosting || !trimmedLocation) ? styles.disabled : null]}
                >
                    <Text style={[styles.quickButtonText, styles.quickButtonTextNegative]}>Sem luz</Text>
                </Pressable>
                <Pressable
                    disabled={isPosting || !trimmedLocation}
                    onPress={() => void submit(`Energia voltou em ${trimmedLocation}`, { location: trimmedLocation, hasPower: true })}
                    style={({ pressed }) => [styles.quickButton, pressed ? styles.pressed : null, (isPosting || !trimmedLocation) ? styles.disabled : null]}
                >
                    <Text style={styles.quickButtonText}>Voltou</Text>
                </Pressable>
            </View>
        </View>
    );
}

function PostCard({ post, onConfirm }: { post: CommunityPost; onConfirm: () => void }) {
    const level = typeof post.payload?.level === 'string' ? (post.payload.level as RuLevel) : null;

    return (
        <View style={styles.postCard}>
            <View style={styles.postHeader}>
                <Text numberOfLines={1} style={styles.postAuthor}>{post.authorName}</Text>
                <Text style={styles.postTime}>{formatRelativeTime(post.createdAt)}</Text>
            </View>
            <Text style={styles.postBody}>{post.body}</Text>
            {level ? (
                <View style={[styles.levelTag, levelTagStyle[level]]}>
                    <Text style={[styles.levelTagText, levelTagTextStyle[level]]}>{RU_LEVEL_LABEL[level]}</Text>
                </View>
            ) : null}
            <Pressable onPress={() => { hapticTap(); onConfirm(); }} style={({ pressed }) => [styles.confirmButton, pressed ? styles.pressed : null]}>
                <CheckCircle2 color={colors.brand} size={16} />
                <Text style={styles.confirmText}>Confirmar{post.confirmCount > 0 ? ` · ${post.confirmCount}` : ''}</Text>
            </Pressable>
        </View>
    );
}

function formatRelativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffMs = Date.now() - then;
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    const days = Math.floor(hours / 24);
    return `há ${days} d`;
}

const styles = StyleSheet.create({
    container: {
        gap: spacing[4]
    },
    disclaimerCard: {
        alignItems: 'flex-start',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing[3],
        padding: spacing[4]
    },
    disclaimerText: {
        ...typography.body,
        color: colors.textMuted,
        flex: 1,
        fontSize: 13
    },
    categoryRow: {
        flexDirection: 'row',
        gap: spacing[2]
    },
    categoryTab: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        paddingVertical: spacing[3]
    },
    categoryTabActive: {
        backgroundColor: colors.brand,
        borderColor: colors.brand
    },
    categoryTabText: {
        ...typography.label,
        color: colors.brand
    },
    categoryTabTextActive: {
        color: colors.inverseText
    },
    composer: {
        ...shadows.elevated,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[3],
        padding: spacing[5]
    },
    composerTitle: {
        ...typography.title,
        ...textShadows.heading,
        color: colors.brandDark,
        fontSize: 16
    },
    input: {
        ...typography.body,
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        borderWidth: 1,
        color: colors.text,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3]
    },
    quickRow: {
        flexDirection: 'row',
        gap: spacing[2]
    },
    quickButton: {
        alignItems: 'center',
        backgroundColor: colors.brandSubtle,
        borderColor: colors.brandMuted,
        borderRadius: radii.md,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        paddingVertical: spacing[3]
    },
    quickButtonPositive: {
        backgroundColor: colors.successSubtle,
        borderColor: colors.successSubtle
    },
    quickButtonNegative: {
        backgroundColor: colors.dangerSubtle,
        borderColor: colors.dangerBorder
    },
    quickButtonText: {
        ...typography.label,
        color: colors.brand
    },
    quickButtonTextPositive: {
        color: colors.success
    },
    quickButtonTextNegative: {
        color: colors.danger
    },
    feed: {
        gap: spacing[3]
    },
    postCard: {
        ...shadows.elevated,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[2],
        padding: spacing[4]
    },
    postHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    postAuthor: {
        ...typography.label,
        color: colors.text,
        flex: 1
    },
    postTime: {
        ...typography.body,
        color: colors.textSubtle,
        fontSize: 12
    },
    postBody: {
        ...typography.body,
        color: colors.text
    },
    levelTag: {
        alignSelf: 'flex-start',
        borderRadius: radii.pill,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1]
    },
    levelTagText: {
        ...typography.label,
        fontSize: 11
    },
    confirmButton: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        gap: spacing[2],
        marginTop: spacing[1],
        paddingVertical: spacing[1]
    },
    confirmText: {
        ...typography.label,
        color: colors.brand
    },
    loadingWrap: {
        paddingVertical: spacing[8]
    },
    emptyCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[3],
        padding: spacing[8]
    },
    emptyText: {
        ...typography.body,
        color: colors.textMuted,
        textAlign: 'center'
    },
    errorBanner: {
        backgroundColor: colors.dangerSubtle,
        borderColor: colors.dangerBorder,
        borderRadius: radii.md,
        borderWidth: 1,
        padding: spacing[3]
    },
    errorText: {
        ...typography.body,
        color: colors.danger
    },
    pressed: {
        opacity: 0.7
    },
    disabled: {
        opacity: 0.5
    }
});

const levelTagStyle = StyleSheet.create({
    empty: { backgroundColor: colors.successSubtle },
    moderate: { backgroundColor: colors.warningSubtle },
    full: { backgroundColor: colors.dangerSubtle }
});

const levelTagTextStyle = StyleSheet.create({
    empty: { color: colors.success },
    moderate: { color: colors.warning },
    full: { color: colors.danger }
});

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, Plus, Search, Send } from 'lucide-react-native';
import { colors, radii, shadows, spacing, textShadows, typography } from '@/shared/design-system';
import { hapticTap } from '@/shared/haptics';
import { useCommunity } from '@/modules/community/presentation/hooks/use-community';
import {
    COMMUNITY_SECTIONS,
    FIELD_LABELS,
    RU_LEVEL_LABEL,
    getCategorySpec,
    getSectionOf,
    type CategorySpec,
    type FieldSpec,
    type SectionSpec
} from '@/modules/community/domain/community-catalog';
import { themeOf } from '@/modules/community/domain/community-theme';
import type { CommunityCategory, CommunityPost, RuLevel } from '@/modules/community/domain/community-post';

type CreateFn = (input: { category: CommunityCategory; body: string; authorName: string; payload?: Record<string, unknown> | null }) => Promise<CommunityPost>;

const ANNOUNCEMENT_SECTIONS = COMMUNITY_SECTIONS.filter((section) => section.categories.every((cat) => cat.kind === 'form'));

export function CommunityPage({ authorName, bottomInset = 96 }: { authorName: string; bottomInset?: number }) {
    const community = useCommunity('FILA_RU');
    const [composeCategory, setComposeCategory] = useState<CommunityCategory | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 5000);
        return () => clearTimeout(timer);
    }, [notice]);

    if (composeCategory) {
        return (
            <ComposeScreen
                initialCategory={composeCategory}
                authorName={authorName}
                isPosting={community.isPosting}
                error={community.error}
                bottomInset={bottomInset}
                onSubmit={community.createPost}
                onCancel={() => setComposeCategory(null)}
                onDone={(status) => {
                    setComposeCategory(null);
                    setNotice(status === 'APPROVED'
                        ? 'Publicado! Já está no ar.'
                        : 'Enviado! Aparece assim que um admin aprovar.');
                }}
            />
        );
    }

    return (
        <ImmersiveFeed
            community={community}
            authorName={authorName}
            notice={notice}
            bottomInset={bottomInset}
            onCompose={(category) => { hapticTap(); setComposeCategory(category); }}
        />
    );
}

// ============================================================ Immersive feed

function ImmersiveFeed({
    community,
    authorName,
    notice,
    bottomInset,
    onCompose
}: {
    community: ReturnType<typeof useCommunity>;
    authorName: string;
    notice: string | null;
    bottomInset: number;
    onCompose: (category: CommunityCategory) => void;
}) {
    const { height } = useWindowDimensions();
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const scrollY = useRef(new Animated.Value(0)).current;

    const activeSection = getSectionOf(community.category);
    const activeCategory = getCategorySpec(community.category);
    const isRealtime = activeCategory.kind === 'quick';

    const cardHeight = Math.max(380, Math.min(height * 0.56, 540));
    const itemSize = cardHeight + spacing[4];

    const filteredPosts = useMemo(() => filterPosts(community.posts, query), [community.posts, query]);

    const selectSection = (section: SectionSpec) => {
        const first = section.categories[0];
        if (first && first.id !== community.category) {
            hapticTap();
            setQuery('');
            community.setCategory(first.id);
        }
    };

    const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true });

    // Realtime categories get a report card as the first item; announcements
    // are view-only in the feed and post via the floating Anunciar button.
    const leadCards = isRealtime ? 1 : 0;

    return (
        <View style={styles.screen}>
            <View style={styles.topBar}>
                {searchOpen ? (
                    <View style={styles.searchBar}>
                        <Search color={colors.textSubtle} size={18} />
                        <TextInput
                            autoFocus
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Buscar..."
                            placeholderTextColor={colors.textSubtle}
                            style={styles.searchInput}
                            returnKeyType="search"
                        />
                        <Pressable onPress={() => { setQuery(''); setSearchOpen(false); }} hitSlop={8}>
                            <Text style={styles.searchCancel}>Cancelar</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
                            {COMMUNITY_SECTIONS.map((section) => {
                                const Icon = section.icon;
                                const active = section.id === activeSection.id;
                                return (
                                    <Pressable
                                        key={section.id}
                                        onPress={() => selectSection(section)}
                                        style={({ pressed }) => [styles.sectionPill, active ? styles.sectionPillActive : null, pressed ? styles.pressed : null]}
                                    >
                                        <Icon color={active ? colors.inverseText : colors.brand} size={15} />
                                        <Text style={[styles.sectionPillText, active ? styles.sectionPillTextActive : null]}>{section.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                        <Pressable onPress={() => setSearchOpen(true)} style={({ pressed }) => [styles.searchButton, pressed ? styles.pressed : null]}>
                            <Search color={colors.textMuted} size={18} />
                        </Pressable>
                    </>
                )}
            </View>

            {activeSection.categories.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipRowWrap}>
                    {activeSection.categories.map((cat) => {
                        const active = cat.id === community.category;
                        return (
                            <Pressable
                                key={cat.id}
                                onPress={() => { hapticTap(); setQuery(''); community.setCategory(cat.id); }}
                                style={({ pressed }) => [styles.chip, active ? styles.chipActive : null, pressed ? styles.pressed : null]}
                            >
                                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{themeOf(cat.id).emoji} {cat.label}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            ) : null}

            {notice ? (
                <View style={styles.noticeCard}>
                    <CheckCircle2 color={colors.success} size={16} />
                    <Text style={styles.noticeText}>{notice}</Text>
                </View>
            ) : null}

            <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                snapToInterval={itemSize}
                decelerationRate="fast"
                contentContainerStyle={{ paddingTop: spacing[2], paddingBottom: bottomInset + spacing[6], paddingHorizontal: spacing[1] }}
            >
                {isRealtime ? (
                    <DepthCard index={0} itemSize={itemSize} scrollY={scrollY} height={cardHeight}>
                        <LiveComposeCard spec={activeCategory} isPosting={community.isPosting} authorName={authorName} onSubmit={community.createPost} />
                    </DepthCard>
                ) : null}

                {community.isLoading ? (
                    <View style={[styles.stateCard, { height: cardHeight }]}>
                        <Text style={styles.stateEmoji}>⏳</Text>
                        <Text style={styles.stateText}>Carregando...</Text>
                    </View>
                ) : filteredPosts.length === 0 ? (
                    <View style={[styles.stateCard, { height: cardHeight }]}>
                        <Text style={styles.stateEmoji}>{query ? '🔍' : themeOf(community.category).emoji}</Text>
                        <Text style={styles.stateText}>
                            {query ? 'Nada encontrado.' : isRealtime ? 'Nenhum relato ainda. Seja o primeiro!' : 'Nenhum anúncio ainda.'}
                        </Text>
                    </View>
                ) : (
                    filteredPosts.map((post, i) => (
                        <DepthCard key={post.id} index={i + leadCards} itemSize={itemSize} scrollY={scrollY} height={cardHeight}>
                            <FeedCard post={post} onConfirm={() => community.confirmPost(post.id)} />
                        </DepthCard>
                    ))
                )}
            </Animated.ScrollView>

            {!isRealtime ? (
                <Pressable
                    onPress={() => onCompose(community.category)}
                    style={({ pressed }) => [styles.fab, { bottom: bottomInset + spacing[4] }, pressed ? styles.fabPressed : null]}
                >
                    <Plus color={colors.inverseText} size={20} />
                    <Text style={styles.fabText}>Anunciar</Text>
                </Pressable>
            ) : null}
        </View>
    );
}

/** Wraps a card so it scales/dims as it moves away from the viewport focus. */
function DepthCard({ index, itemSize, scrollY, height, children }: { index: number; itemSize: number; scrollY: Animated.Value; height: number; children: ReactNode }) {
    const inputRange = [(index - 1) * itemSize, index * itemSize, (index + 1) * itemSize];
    const scale = scrollY.interpolate({ inputRange, outputRange: [0.92, 1, 0.92], extrapolate: 'clamp' });
    const opacity = scrollY.interpolate({ inputRange, outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });

    return (
        <Animated.View style={{ height, marginBottom: spacing[4], opacity, transform: [{ scale }] }}>
            {children}
        </Animated.View>
    );
}

function filterPosts(posts: CommunityPost[], query: string): CommunityPost[] {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    if (!q) return posts;
    return posts.filter((post) => {
        const haystack = [post.body, post.authorName, ...Object.values(post.payload ?? {}).map((v) => String(v))]
            .join(' ')
            .toLocaleLowerCase('pt-BR');
        return haystack.includes(q);
    });
}

// ============================================================= Feed card

function FeedCard({ post, onConfirm }: { post: CommunityPost; onConfirm: () => void }) {
    const spec = getCategorySpec(post.category);
    const theme = themeOf(post.category);
    const payload = post.payload ?? {};
    const isRealtime = spec.kind === 'quick';
    const description = typeof payload.descricao === 'string' ? payload.descricao : null;
    const primaryKey = spec.primaryKey ?? 'titulo';
    const link = typeof payload.link === 'string' ? payload.link : null;

    const chips = spec.kind === 'form'
        ? (spec.fields ?? [])
            .filter((field) => field.key !== primaryKey && field.key !== 'descricao' && field.key !== 'link')
            .map((field) => [field.key, payload[field.key]] as const)
            .filter(([, val]) => typeof val === 'string' && (val as string).length > 0)
        : [];

    return (
        <View style={styles.card}>
            <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.cardVignette} />
            <View style={styles.cardInner}>
                <View style={styles.cardTopRow}>
                    <View style={styles.glassBadge}>
                        <Text style={styles.badgeEmoji}>{theme.emoji}</Text>
                        <Text style={styles.badgeLabel}>{spec.label}</Text>
                    </View>
                    <View style={styles.glassChip}>
                        {isRealtime ? <LiveDot /> : <Clock color="rgba(255,255,255,0.85)" size={12} />}
                        <Text style={styles.timeText}>{isRealtime ? 'AO VIVO · ' : ''}{formatRelativeTime(post.createdAt)}</Text>
                    </View>
                </View>

                <View style={styles.cardCenter}>
                    {isRealtime ? <HeroStatus post={post} accent={theme.accent} /> : null}
                    <Text style={[styles.cardTitle, isRealtime ? styles.cardTitleSmall : null]} numberOfLines={isRealtime ? 2 : 3}>{post.body}</Text>
                    {description ? <Text style={styles.cardDescription} numberOfLines={3}>{description}</Text> : null}
                    {chips.length > 0 ? (
                        <View style={styles.chipsWrap}>
                            {chips.map(([key, val]) => (
                                <View key={key} style={styles.detailChip}>
                                    <Text style={styles.detailChipText}>
                                        {FIELD_LABELS[key] ? `${FIELD_LABELS[key]} · ` : ''}{String(val)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                    {link ? (
                        <Pressable onPress={() => openLink(link)} style={({ pressed }) => [styles.linkChip, pressed ? styles.pressed : null]}>
                            <ExternalLink color={colors.text} size={14} />
                            <Text numberOfLines={1} style={styles.linkChipText}>Abrir link</Text>
                        </Pressable>
                    ) : null}
                </View>

                <View style={styles.cardBottomRow}>
                    <View style={styles.authorChip}>
                        <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(post.authorName)}</Text></View>
                        <Text numberOfLines={1} style={styles.authorName}>{post.authorName}</Text>
                    </View>
                    {isRealtime ? (
                        <Pressable onPress={() => { hapticTap(); onConfirm(); }} style={({ pressed }) => [styles.confirmPill, pressed ? styles.pressed : null]}>
                            <CheckCircle2 color={colors.text} size={15} />
                            <Text style={styles.confirmPillText}>Confirmar{post.confirmCount > 0 ? ` · ${post.confirmCount}` : ''}</Text>
                        </Pressable>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

function HeroStatus({ post, accent }: { post: CommunityPost; accent: string }) {
    const payload = post.payload ?? {};
    const level = typeof payload.level === 'string' ? (payload.level as RuLevel) : null;

    if (level) {
        const fill = level === 'empty' ? 1 : level === 'moderate' ? 2 : 3;
        return (
            <View style={styles.hero}>
                <Text style={[styles.heroWord, { color: accent }]}>{RU_LEVEL_LABEL[level].toUpperCase()}</Text>
                <View style={styles.meter}>
                    {[1, 2, 3].map((seg) => (
                        <View key={seg} style={[styles.meterSeg, seg <= fill ? { backgroundColor: accent } : null]} />
                    ))}
                </View>
            </View>
        );
    }

    if (typeof payload.dropped === 'boolean') {
        return <Text style={[styles.heroWord, { color: accent }]}>{payload.dropped ? 'CAIU ✓' : 'AINDA NÃO'}</Text>;
    }
    if (typeof payload.hasPower === 'boolean') {
        return <Text style={[styles.heroWord, { color: accent }]}>{payload.hasPower ? 'VOLTOU ✓' : 'SEM LUZ'}</Text>;
    }
    return null;
}

function LiveDot() {
    const pulse = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true })
        ]));
        loop.start();
        return () => loop.stop();
    }, [pulse]);
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
    return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

// ============================================================ Live report card

function LiveComposeCard({ spec, isPosting, authorName, onSubmit }: { spec: CategorySpec; isPosting: boolean; authorName: string; onSubmit: CreateFn }) {
    const [value, setValue] = useState('');
    const theme = themeOf(spec.id);
    const quick = spec.quick;
    if (!quick) return null;

    const needsValue = Boolean(quick.needsFieldKey);
    const trimmed = value.trim();
    const disabled = isPosting || (needsValue && !trimmed);

    const submit = async (body: string, payload: Record<string, unknown>) => {
        hapticTap();
        try {
            await onSubmit({ category: spec.id, body, authorName, payload });
            setValue('');
        } catch {
            // error surfaced by the hook
        }
    };

    return (
        <View style={styles.card}>
            <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.cardVignette} />
            <View style={styles.cardInner}>
                <View style={styles.glassBadge}>
                    <Text style={styles.badgeEmoji}>{theme.emoji}</Text>
                    <Text style={styles.badgeLabel}>Reportar agora</Text>
                </View>
                <View style={styles.cardCenter}>
                    <Text style={styles.composePrompt}>{quick.prompt}</Text>
                    {needsValue ? (
                        <TextInput
                            value={value}
                            onChangeText={setValue}
                            placeholder={quick.needsFieldLabel}
                            placeholderTextColor="rgba(255,255,255,0.6)"
                            style={styles.glassInput}
                            maxLength={80}
                        />
                    ) : null}
                    <View style={styles.quickRow}>
                        {quick.options(trimmed).map((option) => (
                            <Pressable
                                key={option.label}
                                disabled={disabled}
                                onPress={() => void submit(option.body, option.payload)}
                                style={({ pressed }) => [styles.quickButton, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
                            >
                                <Text style={styles.quickButtonText}>{option.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
                <Text style={styles.composeFootnote}>Seu relato aparece na hora para a comunidade.</Text>
            </View>
        </View>
    );
}

// ============================================================ Compose (announcements)

function ComposeScreen({
    initialCategory,
    authorName,
    isPosting,
    error,
    bottomInset,
    onSubmit,
    onCancel,
    onDone
}: {
    initialCategory: CommunityCategory;
    authorName: string;
    isPosting: boolean;
    error: string | null;
    bottomInset: number;
    onSubmit: CreateFn;
    onCancel: () => void;
    onDone: (status: CommunityPost['status']) => void;
}) {
    const [category, setCategory] = useState<CommunityCategory>(initialCategory);
    const activeSection = getSectionOf(category);
    const spec = getCategorySpec(category);

    return (
        <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing[4], paddingBottom: bottomInset + spacing[6], gap: spacing[4] }}>
            <View style={styles.composeHeader}>
                <Pressable onPress={() => { hapticTap(); onCancel(); }} style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}>
                    <ArrowLeft color={colors.text} size={20} />
                </Pressable>
                <Text style={styles.composeTitle}>Novo anúncio</Text>
            </View>
            <Text style={styles.composeHint}>Escolha a categoria e preencha os detalhes. Seu anúncio passa por aprovação antes de aparecer para todos.</Text>

            {ANNOUNCEMENT_SECTIONS.map((section) => (
                <View key={section.id} style={styles.composeSectionBlock}>
                    <Text style={styles.composeSectionLabel}>{section.label}</Text>
                    <View style={styles.wrapRow}>
                        {section.categories.map((cat) => {
                            const active = cat.id === category;
                            return (
                                <Pressable
                                    key={cat.id}
                                    onPress={() => { hapticTap(); setCategory(cat.id); }}
                                    style={({ pressed }) => [styles.chip, active ? styles.chipActive : null, pressed ? styles.pressed : null]}
                                >
                                    <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{themeOf(cat.id).emoji} {cat.label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            ))}

            <FormComposer key={spec.id} spec={spec} sectionLabel={activeSection.label} isPosting={isPosting} authorName={authorName} onSubmit={onSubmit} onDone={onDone} />

            {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
        </ScrollView>
    );
}

function FormComposer({
    spec, sectionLabel, isPosting, authorName, onSubmit, onDone
}: {
    spec: CategorySpec; sectionLabel: string; isPosting: boolean; authorName: string; onSubmit: CreateFn; onDone: (status: CommunityPost['status']) => void;
}) {
    const fields = spec.fields ?? [];
    const [values, setValues] = useState<Record<string, string>>({});
    const setField = (key: string, val: string) => setValues((current) => ({ ...current, [key]: val }));

    const missingRequired = fields.some((field) => field.required && !(values[field.key] ?? '').trim());
    const primaryKey = spec.primaryKey ?? 'titulo';
    const disabled = isPosting || missingRequired;

    const submit = async () => {
        hapticTap();
        const payload: Record<string, unknown> = {};
        for (const field of fields) {
            const raw = (values[field.key] ?? '').trim();
            if (raw) payload[field.key] = raw;
        }
        const body = (values[primaryKey] ?? '').trim() || spec.label;
        try {
            const created = await onSubmit({ category: spec.id, body, authorName, payload });
            setValues({});
            onDone(created.status);
        } catch {
            // error surfaced upstream
        }
    };

    return (
        <View style={styles.composer}>
            <Text style={styles.composerTitle}>{themeOf(spec.id).emoji} {spec.label} · {sectionLabel}</Text>
            {fields.map((field) => (
                <FieldInput key={field.key} field={field} value={values[field.key] ?? ''} onChange={(val) => setField(field.key, val)} />
            ))}
            <Pressable disabled={disabled} onPress={() => void submit()} style={({ pressed }) => [styles.submitButton, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}>
                <Send color={colors.inverseText} size={16} />
                <Text style={styles.submitButtonText}>Enviar para aprovação</Text>
            </Pressable>
        </View>
    );
}

function FieldInput({ field, value, onChange }: { field: FieldSpec; value: string; onChange: (value: string) => void }) {
    if (field.type === 'select') {
        return (
            <View style={styles.selectRow}>
                {(field.options ?? []).map((option) => {
                    const active = value === option;
                    return (
                        <Pressable key={option} onPress={() => { hapticTap(); onChange(option); }} style={({ pressed }) => [styles.selectChip, active ? styles.selectChipActive : null, pressed ? styles.pressed : null]}>
                            <Text style={[styles.selectChipText, active ? styles.selectChipTextActive : null]}>{option}</Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    }

    const multiline = field.type === 'multiline';
    return (
        <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={field.placeholder ?? field.label}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, multiline ? styles.inputMultiline : null]}
            maxLength={field.maxLength}
            multiline={multiline}
            keyboardType={field.type === 'number' ? 'numeric' : field.type === 'url' ? 'url' : 'default'}
            autoCapitalize={field.type === 'url' ? 'none' : 'sentences'}
        />
    );
}

// ============================================================ helpers

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0]![0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
    return (first + last).toLocaleUpperCase('pt-BR');
}

function openLink(url: string): void {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    void Linking.openURL(normalized).catch(() => undefined);
}

function formatRelativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const minutes = Math.floor((Date.now() - then) / 60000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    return `há ${Math.floor(hours / 24)} d`;
}

const GLASS = 'rgba(255,255,255,0.16)';
const GLASS_BORDER = 'rgba(255,255,255,0.28)';

const styles = StyleSheet.create({
    screen: {
        flex: 1
    },
    topBar: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    sectionRow: {
        gap: spacing[2],
        paddingRight: spacing[2]
    },
    sectionPill: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    sectionPillActive: {
        backgroundColor: colors.brand,
        borderColor: colors.brand
    },
    sectionPillText: {
        ...typography.label,
        color: colors.brand
    },
    sectionPillTextActive: {
        color: colors.inverseText
    },
    searchButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        height: 38,
        justifyContent: 'center',
        width: 38
    },
    searchBar: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4]
    },
    searchInput: {
        ...typography.body,
        color: colors.text,
        flex: 1,
        paddingVertical: spacing[2]
    },
    searchCancel: {
        ...typography.label,
        color: colors.brand
    },
    chipRowWrap: {
        flexGrow: 0
    },
    chipRow: {
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingBottom: spacing[2]
    },
    chip: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    chipActive: {
        backgroundColor: colors.brandSubtle,
        borderColor: colors.brand
    },
    chipText: {
        ...typography.body,
        color: colors.textMuted,
        fontSize: 13
    },
    chipTextActive: {
        color: colors.brand,
        fontWeight: '700'
    },
    wrapRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2]
    },
    noticeCard: {
        alignItems: 'center',
        backgroundColor: colors.successSubtle,
        borderColor: colors.success,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[2],
        marginHorizontal: spacing[4],
        marginBottom: spacing[1],
        padding: spacing[3]
    },
    noticeText: {
        ...typography.label,
        color: colors.success,
        flex: 1
    },
    // Immersive card
    card: {
        borderRadius: radii.lg + 8,
        flex: 1,
        overflow: 'hidden',
        ...shadows.elevated
    },
    cardVignette: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.12)'
    },
    cardInner: {
        flex: 1,
        justifyContent: 'space-between',
        padding: spacing[5]
    },
    cardTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    glassBadge: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: GLASS,
        borderColor: GLASS_BORDER,
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    badgeEmoji: {
        fontSize: 16
    },
    badgeLabel: {
        ...typography.label,
        color: colors.inverseText,
        fontSize: 12
    },
    glassChip: {
        alignItems: 'center',
        backgroundColor: GLASS,
        borderColor: GLASS_BORDER,
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1]
    },
    timeText: {
        color: 'rgba(255,255,255,0.9)',
        fontFamily: typography.label.fontFamily,
        fontSize: 11,
        fontWeight: '700'
    },
    liveDot: {
        backgroundColor: '#FFFFFF',
        borderRadius: radii.pill,
        height: 7,
        width: 7
    },
    cardCenter: {
        flex: 1,
        gap: spacing[3],
        justifyContent: 'center'
    },
    hero: {
        gap: spacing[3]
    },
    heroWord: {
        fontFamily: typography.title.fontFamily,
        fontSize: 46,
        fontWeight: '900',
        letterSpacing: -1,
        ...textShadows.heroOnBrand
    },
    meter: {
        flexDirection: 'row',
        gap: spacing[2]
    },
    meterSeg: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: radii.pill,
        flex: 1,
        height: 8
    },
    cardTitle: {
        color: colors.inverseText,
        fontFamily: typography.title.fontFamily,
        fontSize: 26,
        fontWeight: '800',
        lineHeight: 32,
        ...textShadows.heroOnBrand
    },
    cardTitleSmall: {
        fontSize: 19,
        lineHeight: 24
    },
    cardDescription: {
        color: 'rgba(255,255,255,0.92)',
        fontFamily: typography.body.fontFamily,
        fontSize: 14,
        lineHeight: 20
    },
    chipsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2]
    },
    detailChip: {
        backgroundColor: GLASS,
        borderColor: GLASS_BORDER,
        borderRadius: radii.md,
        borderWidth: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1]
    },
    detailChipText: {
        color: colors.inverseText,
        fontFamily: typography.body.fontFamily,
        fontSize: 12.5,
        fontWeight: '600'
    },
    linkChip: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    linkChipText: {
        ...typography.label,
        color: colors.text
    },
    cardBottomRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    authorChip: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: spacing[2]
    },
    avatar: {
        alignItems: 'center',
        backgroundColor: GLASS,
        borderColor: GLASS_BORDER,
        borderRadius: radii.pill,
        borderWidth: 1,
        height: 30,
        justifyContent: 'center',
        width: 30
    },
    avatarText: {
        color: colors.inverseText,
        fontFamily: typography.label.fontFamily,
        fontSize: 11,
        fontWeight: '800'
    },
    authorName: {
        color: 'rgba(255,255,255,0.95)',
        flexShrink: 1,
        fontFamily: typography.label.fontFamily,
        fontSize: 13,
        fontWeight: '700'
    },
    confirmPill: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    confirmPillText: {
        ...typography.label,
        color: colors.text
    },
    // Live compose card
    composePrompt: {
        color: colors.inverseText,
        fontFamily: typography.title.fontFamily,
        fontSize: 24,
        fontWeight: '800',
        lineHeight: 30,
        ...textShadows.heroOnBrand
    },
    glassInput: {
        backgroundColor: GLASS,
        borderColor: GLASS_BORDER,
        borderRadius: radii.md,
        borderWidth: 1,
        color: colors.inverseText,
        fontFamily: typography.body.fontFamily,
        fontSize: 15,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3]
    },
    quickRow: {
        flexDirection: 'row',
        gap: spacing[2]
    },
    quickButton: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: radii.md,
        flex: 1,
        justifyContent: 'center',
        paddingVertical: spacing[3]
    },
    quickButtonText: {
        ...typography.label,
        color: colors.text,
        fontSize: 13
    },
    composeFootnote: {
        color: 'rgba(255,255,255,0.85)',
        fontFamily: typography.body.fontFamily,
        fontSize: 12
    },
    // State cards
    stateCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg + 8,
        borderWidth: 1,
        gap: spacing[3],
        justifyContent: 'center',
        marginBottom: spacing[4],
        padding: spacing[6]
    },
    stateEmoji: {
        fontSize: 40
    },
    stateText: {
        ...typography.body,
        color: colors.textMuted,
        textAlign: 'center'
    },
    // FAB
    fab: {
        ...shadows.elevated,
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[3],
        position: 'absolute'
    },
    fabPressed: {
        opacity: 0.85
    },
    fabText: {
        ...typography.label,
        color: colors.inverseText,
        fontSize: 14
    },
    // Compose screen
    composeHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[3]
    },
    backButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        height: 40,
        justifyContent: 'center',
        width: 40
    },
    composeTitle: {
        ...typography.title,
        ...textShadows.heading,
        color: colors.brandDark
    },
    composeHint: {
        ...typography.body,
        color: colors.textMuted,
        fontSize: 13
    },
    composeSectionBlock: {
        gap: spacing[2]
    },
    composeSectionLabel: {
        ...typography.eyebrow,
        color: colors.textSubtle,
        textTransform: 'uppercase'
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
    inputMultiline: {
        minHeight: 72,
        textAlignVertical: 'top'
    },
    selectRow: {
        flexDirection: 'row',
        gap: spacing[2]
    },
    selectChip: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        borderWidth: 1,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    selectChipActive: {
        backgroundColor: colors.brand,
        borderColor: colors.brand
    },
    selectChipText: {
        ...typography.label,
        color: colors.brand
    },
    selectChipTextActive: {
        color: colors.inverseText
    },
    submitButton: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        paddingVertical: spacing[4]
    },
    submitButtonText: {
        ...typography.label,
        color: colors.inverseText,
        fontSize: 14
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

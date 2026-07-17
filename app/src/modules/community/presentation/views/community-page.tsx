import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, CheckCircle2, ChevronRight, ExternalLink, Plus, Search, Send, X } from 'lucide-react-native';
import { colors, gradients, radii, shadows, spacing, textShadows, typography } from '@/shared/design-system';
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

// Sections kept in the catalog but not yet launched — hidden from the UI
// (not deleted, so re-enabling later is a one-line change).
const HIDDEN_SECTION_IDS = new Set(['oportunidades']);
const VISIBLE_SECTIONS = COMMUNITY_SECTIONS.filter((section) => !HIDDEN_SECTION_IDS.has(section.id));

const ANNOUNCEMENT_SECTIONS = VISIBLE_SECTIONS.filter((section) => section.categories.every((cat) => cat.kind === 'form'));

/** Soft tinted background for a category token on a white card. */
function softTint(accent: string): string {
    return `${accent}26`;
}

export function CommunityPage({ authorName, bottomInset = 96, onBack }: { authorName: string; bottomInset?: number; onBack?: () => void }) {
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
        <Feed
            community={community}
            authorName={authorName}
            notice={notice}
            bottomInset={bottomInset}
            onBack={onBack}
            onCompose={(category) => { hapticTap(); setComposeCategory(category); }}
        />
    );
}

// ================================================================= Feed

function Feed({
    community,
    authorName,
    notice,
    bottomInset,
    onBack,
    onCompose
}: {
    community: ReturnType<typeof useCommunity>;
    authorName: string;
    notice: string | null;
    bottomInset: number;
    onBack?: () => void;
    onCompose: (category: CommunityCategory) => void;
}) {
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);

    const activeSection = getSectionOf(community.category);
    const activeCategory = getCategorySpec(community.category);
    const isRealtime = activeCategory.kind === 'quick';

    const filteredPosts = useMemo(() => filterPosts(community.posts, query), [community.posts, query]);

    const selectSection = (section: SectionSpec) => {
        const first = section.categories[0];
        if (first && first.id !== community.category) {
            hapticTap();
            setQuery('');
            community.setCategory(first.id);
        }
    };

    return (
        <View style={styles.screen}>
            {/* ---- Brand hero header ---- */}
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <View style={styles.heroInner}>
                    <View style={styles.heroTopRow}>
                        {onBack ? (
                            <Pressable onPress={() => { hapticTap(); onBack(); }} style={({ pressed }) => [styles.heroIconButton, pressed ? styles.pressed : null]}>
                                <ArrowLeft color={colors.inverseText} size={18} />
                            </Pressable>
                        ) : null}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.heroEyebrow}>COMUNIDADE UFAM</Text>
                            <Text style={styles.heroTitle}>{isRealtime ? 'Agora no campus' : activeSection.label}</Text>
                        </View>
                        <Pressable onPress={() => { hapticTap(); setSearchOpen((v) => !v); }} style={({ pressed }) => [styles.heroIconButton, pressed ? styles.pressed : null]}>
                            {searchOpen ? <X color={colors.inverseText} size={18} /> : <Search color={colors.inverseText} size={18} />}
                        </Pressable>
                    </View>

                    {searchOpen ? (
                        <View style={styles.searchBar}>
                            <Search color="rgba(255,255,255,0.8)" size={16} />
                            <TextInput
                                autoFocus
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Buscar na comunidade..."
                                placeholderTextColor="rgba(255,255,255,0.65)"
                                style={styles.searchInput}
                                returnKeyType="search"
                            />
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
                            {VISIBLE_SECTIONS.map((section) => {
                                const Icon = section.icon;
                                const active = section.id === activeSection.id;
                                return (
                                    <Pressable
                                        key={section.id}
                                        onPress={() => selectSection(section)}
                                        style={({ pressed }) => [styles.sectionPill, active ? styles.sectionPillActive : null, pressed ? styles.pressed : null]}
                                    >
                                        <Icon color={active ? colors.brand : colors.inverseText} size={14} />
                                        <Text style={[styles.sectionPillText, active ? styles.sectionPillTextActive : null]}>{section.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            </LinearGradient>

            {/* ---- Category chips ---- */}
            {activeSection.categories.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={[styles.chipRowWrap, styles.contentColumn]}>
                    {activeSection.categories.map((cat) => {
                        const active = cat.id === community.category;
                        const theme = themeOf(cat.id);
                        return (
                            <Pressable
                                key={cat.id}
                                onPress={() => { hapticTap(); setQuery(''); community.setCategory(cat.id); }}
                                style={({ pressed }) => [styles.chip, active ? { backgroundColor: theme.gradient[1], borderColor: theme.gradient[1] } : null, pressed ? styles.pressed : null]}
                            >
                                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{theme.emoji}  {cat.label}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            ) : null}

            {notice ? (
                <View style={[styles.noticeCard, styles.contentColumn]}>
                    <CheckCircle2 color={colors.success} size={16} />
                    <Text style={styles.noticeText}>{notice}</Text>
                </View>
            ) : null}

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[{ paddingTop: spacing[4], paddingBottom: bottomInset + spacing[10], paddingHorizontal: spacing[4], gap: spacing[4] }, styles.contentColumn]}
            >
                {isRealtime ? (
                    <LiveComposer spec={activeCategory} isPosting={community.isPosting} authorName={authorName} onSubmit={community.createPost} />
                ) : null}

                {isRealtime && filteredPosts.length > 0 ? (
                    <Text style={styles.feedHeading}>Relatos recentes</Text>
                ) : null}

                {community.isLoading ? (
                    <EmptyState emoji="⏳" text="Carregando..." />
                ) : filteredPosts.length === 0 ? (
                    <EmptyState
                        emoji={query ? '🔍' : themeOf(community.category).emoji}
                        text={query ? 'Nada encontrado.' : isRealtime ? 'Nenhum relato ainda. Seja o primeiro acima!' : 'Nenhum anúncio ainda. Toque em Anunciar para começar.'}
                    />
                ) : (
                    filteredPosts.map((post, i) => (
                        <RiseIn key={post.id} index={i}>
                            <FeedCard post={post} onConfirm={() => community.confirmPost(post.id)} />
                        </RiseIn>
                    ))
                )}
            </ScrollView>

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

function EmptyState({ emoji, text }: { emoji: string; text: string }) {
    return (
        <View style={styles.stateCard}>
            <Text style={styles.stateEmoji}>{emoji}</Text>
            <Text style={styles.stateText}>{text}</Text>
        </View>
    );
}

/** Subtle fade + rise-in as cards mount — premium feel without scroll gimmicks. */
function RiseIn({ index, children }: { index: number; children: ReactNode }) {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(anim, {
            toValue: 1,
            duration: 340,
            delay: Math.min(index, 6) * 55,
            useNativeDriver: true
        }).start();
    }, [anim, index]);
    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
    return <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>{children}</Animated.View>;
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
    const accent = theme.gradient[1];
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
            <View style={[styles.cardAccent, { backgroundColor: accent }]} />
            <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                    <View style={[styles.token, { backgroundColor: softTint(theme.accent) }]}>
                        <Text style={styles.tokenEmoji}>{theme.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cardCategory, { color: accent }]}>{spec.label}</Text>
                        <View style={styles.metaRow}>
                            {isRealtime ? <LiveDot color={accent} /> : null}
                            <Text style={styles.cardTime}>{isRealtime ? 'ao vivo · ' : ''}{formatRelativeTime(post.createdAt)}</Text>
                        </View>
                    </View>
                </View>

                {isRealtime ? <StatusBadge post={post} accent={accent} /> : null}

                <Text style={styles.cardTitle} numberOfLines={4}>{post.body}</Text>
                {description ? <Text style={styles.cardDescription} numberOfLines={4}>{description}</Text> : null}

                {chips.length > 0 ? (
                    <View style={styles.chipsWrap}>
                        {chips.map(([key, val]) => (
                            <View key={key} style={styles.detailChip}>
                                {FIELD_LABELS[key] ? <Text style={styles.detailChipLabel}>{FIELD_LABELS[key]}</Text> : null}
                                <Text style={styles.detailChipValue}>{String(val)}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {link ? (
                    <Pressable onPress={() => openLink(link)} style={({ pressed }) => [styles.linkButton, pressed ? styles.pressed : null]}>
                        <ExternalLink color={colors.brand} size={15} />
                        <Text style={styles.linkButtonText}>Abrir link</Text>
                        <ChevronRight color={colors.brand} size={15} />
                    </Pressable>
                ) : null}

                <View style={styles.cardFooter}>
                    <View style={styles.authorChip}>
                        <View style={[styles.avatar, { backgroundColor: softTint(theme.accent) }]}>
                            <Text style={[styles.avatarText, { color: accent }]}>{initialsOf(post.authorName)}</Text>
                        </View>
                        <Text numberOfLines={1} style={styles.authorName}>{post.authorName}</Text>
                    </View>
                    {isRealtime ? (
                        <Pressable onPress={() => { hapticTap(); onConfirm(); }} style={({ pressed }) => [styles.confirmPill, pressed ? styles.pressed : null]}>
                            <CheckCircle2 color={colors.brand} size={15} />
                            <Text style={styles.confirmPillText}>Confirmar{post.confirmCount > 0 ? ` · ${post.confirmCount}` : ''}</Text>
                        </Pressable>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

function StatusBadge({ post, accent }: { post: CommunityPost; accent: string }) {
    const payload = post.payload ?? {};
    const level = typeof payload.level === 'string' ? (payload.level as RuLevel) : null;

    if (level) {
        const fill = level === 'empty' ? 1 : level === 'moderate' ? 2 : 3;
        return (
            <View style={styles.statusBlock}>
                <Text style={[styles.statusWord, { color: accent }]}>{RU_LEVEL_LABEL[level]}</Text>
                <View style={styles.meter}>
                    {[1, 2, 3].map((seg) => (
                        <View key={seg} style={[styles.meterSeg, seg <= fill ? { backgroundColor: accent } : null]} />
                    ))}
                </View>
            </View>
        );
    }
    if (typeof payload.dropped === 'boolean') {
        return <Text style={[styles.statusWord, { color: accent }]}>{payload.dropped ? 'Caiu ✓' : 'Ainda não caiu'}</Text>;
    }
    if (typeof payload.hasPower === 'boolean') {
        return <Text style={[styles.statusWord, { color: accent }]}>{payload.hasPower ? 'Energia voltou ✓' : 'Sem energia'}</Text>;
    }
    return null;
}

function LiveDot({ color }: { color: string }) {
    const pulse = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true })
        ]));
        loop.start();
        return () => loop.stop();
    }, [pulse]);
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
    return <Animated.View style={[styles.liveDot, { backgroundColor: color, opacity }]} />;
}

// ==================================================== Live report composer

function LiveComposer({ spec, isPosting, authorName, onSubmit }: { spec: CategorySpec; isPosting: boolean; authorName: string; onSubmit: CreateFn }) {
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
        <View style={styles.composerCard}>
            <View style={styles.composerHeader}>
                <View style={[styles.token, { backgroundColor: softTint(theme.accent) }]}>
                    <Text style={styles.tokenEmoji}>{theme.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.composerEyebrow}>REPORTE AGORA</Text>
                    <Text style={styles.composerPrompt}>{quick.prompt}</Text>
                </View>
            </View>

            {needsValue ? (
                <TextInput
                    value={value}
                    onChangeText={setValue}
                    placeholder={quick.needsFieldLabel}
                    placeholderTextColor={colors.textSubtle}
                    style={styles.composerInput}
                    maxLength={80}
                />
            ) : null}

            <View style={styles.quickRow}>
                {quick.options(trimmed).map((option) => {
                    const tone = option.tone;
                    const toneStyle = tone === 'positive' ? styles.quickPositive : tone === 'negative' ? styles.quickNegative : styles.quickNeutral;
                    return (
                        <Pressable
                            key={option.label}
                            disabled={disabled}
                            onPress={() => void submit(option.body, option.payload)}
                            style={({ pressed }) => [styles.quickButton, toneStyle, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
                        >
                            <Text style={[styles.quickButtonText, tone === 'neutral' ? styles.quickButtonTextNeutral : null]}>{option.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
            <Text style={styles.composerFootnote}>Aparece na hora para toda a comunidade.</Text>
        </View>
    );
}

// ================================================= Compose (announcements)

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
    const theme = themeOf(category);

    return (
        <View style={styles.screen}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <View style={styles.heroInner}>
                    <View style={styles.heroTopRow}>
                        <Pressable onPress={() => { hapticTap(); onCancel(); }} style={({ pressed }) => [styles.heroIconButton, pressed ? styles.pressed : null]}>
                            <ArrowLeft color={colors.inverseText} size={18} />
                        </Pressable>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.heroEyebrow}>NOVO ANÚNCIO</Text>
                            <Text style={styles.heroTitle}>Divulgar algo</Text>
                        </View>
                    </View>
                    <Text style={styles.heroSubtitle}>Passa por aprovação de um administrador antes de aparecer para todos.</Text>
                </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={[{ padding: spacing[4], paddingBottom: bottomInset + spacing[10], gap: spacing[5] }, styles.contentColumn]}>
                {ANNOUNCEMENT_SECTIONS.map((section) => (
                    <View key={section.id} style={styles.composeSectionBlock}>
                        <Text style={styles.composeSectionLabel}>{section.label}</Text>
                        <View style={styles.wrapRow}>
                            {section.categories.map((cat) => {
                                const active = cat.id === category;
                                const catTheme = themeOf(cat.id);
                                return (
                                    <Pressable
                                        key={cat.id}
                                        onPress={() => { hapticTap(); setCategory(cat.id); }}
                                        style={({ pressed }) => [styles.chip, active ? { backgroundColor: catTheme.gradient[1], borderColor: catTheme.gradient[1] } : null, pressed ? styles.pressed : null]}
                                    >
                                        <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{catTheme.emoji}  {cat.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                ))}

                <FormComposer key={spec.id} spec={spec} sectionLabel={activeSection.label} accent={theme.gradient[1]} emoji={theme.emoji} isPosting={isPosting} authorName={authorName} onSubmit={onSubmit} onDone={onDone} />

                {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
            </ScrollView>
        </View>
    );
}

function FormComposer({
    spec, sectionLabel, accent, emoji, isPosting, authorName, onSubmit, onDone
}: {
    spec: CategorySpec; sectionLabel: string; accent: string; emoji: string; isPosting: boolean; authorName: string; onSubmit: CreateFn; onDone: (status: CommunityPost['status']) => void;
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
            <View style={styles.composerTitleRow}>
                <Text style={[styles.composerBadgeEmoji, { color: accent }]}>{emoji}</Text>
                <Text style={styles.composerTitle}>{spec.label} · {sectionLabel}</Text>
            </View>
            {fields.map((field) => (
                <View key={field.key} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
                    <FieldInput field={field} accent={accent} value={values[field.key] ?? ''} onChange={(val) => setField(field.key, val)} />
                </View>
            ))}
            <Pressable disabled={disabled} onPress={() => void submit()} style={({ pressed }) => [styles.submitButton, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}>
                <Send color={colors.inverseText} size={16} />
                <Text style={styles.submitButtonText}>Enviar para aprovação</Text>
            </Pressable>
        </View>
    );
}

function FieldInput({ field, accent, value, onChange }: { field: FieldSpec; accent: string; value: string; onChange: (value: string) => void }) {
    if (field.type === 'select') {
        return (
            <View style={styles.selectRow}>
                {(field.options ?? []).map((option) => {
                    const active = value === option;
                    return (
                        <Pressable key={option} onPress={() => { hapticTap(); onChange(option); }} style={({ pressed }) => [styles.selectChip, active ? { backgroundColor: accent, borderColor: accent } : null, pressed ? styles.pressed : null]}>
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

// ==================================================================== helpers

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

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.canvas,
        flex: 1
    },
    // Caps content to a centered column on wide screens (web/desktop/tablet);
    // collapses to full width on phones. Keeps the feed readable everywhere.
    contentColumn: {
        alignSelf: 'center',
        maxWidth: 680,
        width: '100%'
    },
    heroInner: {
        alignSelf: 'center',
        gap: spacing[4],
        maxWidth: 680,
        width: '100%'
    },
    // ---- Hero header ----
    hero: {
        borderBottomLeftRadius: radii.lg + 14,
        borderBottomRightRadius: radii.lg + 14,
        gap: spacing[4],
        paddingBottom: spacing[5],
        paddingHorizontal: spacing[4],
        paddingTop: spacing[5],
        ...shadows.elevated
    },
    heroTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[3]
    },
    heroEyebrow: {
        color: 'rgba(255,255,255,0.75)',
        fontFamily: typography.eyebrow.fontFamily,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.2
    },
    heroTitle: {
        color: colors.inverseText,
        fontFamily: typography.title.fontFamily,
        fontSize: 27,
        fontWeight: '800',
        letterSpacing: -0.5,
        marginTop: 2,
        ...textShadows.heroOnBrand
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontFamily: typography.body.fontFamily,
        fontSize: 13,
        lineHeight: 18
    },
    heroIconButton: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderColor: 'rgba(255,255,255,0.24)',
        borderRadius: radii.pill,
        borderWidth: 1,
        height: 40,
        justifyContent: 'center',
        width: 40
    },
    searchBar: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderColor: 'rgba(255,255,255,0.24)',
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4]
    },
    searchInput: {
        color: colors.inverseText,
        flex: 1,
        fontFamily: typography.body.fontFamily,
        fontSize: 15,
        paddingVertical: spacing[3]
    },
    sectionRow: {
        gap: spacing[2],
        paddingRight: spacing[2]
    },
    sectionPill: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderColor: 'rgba(255,255,255,0.22)',
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    sectionPillActive: {
        backgroundColor: colors.inverseText,
        borderColor: colors.inverseText
    },
    sectionPillText: {
        color: colors.inverseText,
        fontFamily: typography.label.fontFamily,
        fontSize: 12,
        fontWeight: '700'
    },
    sectionPillTextActive: {
        color: colors.brand
    },
    // ---- Category chips ----
    chipRowWrap: {
        flexGrow: 0,
        marginTop: spacing[3]
    },
    chipRow: {
        gap: spacing[2],
        paddingHorizontal: spacing[4]
    },
    chip: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    chipText: {
        color: colors.textMuted,
        fontFamily: typography.label.fontFamily,
        fontSize: 13,
        fontWeight: '700'
    },
    chipTextActive: {
        color: colors.inverseText
    },
    wrapRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2]
    },
    // ---- Notice ----
    noticeCard: {
        alignItems: 'center',
        backgroundColor: colors.successSubtle,
        borderColor: colors.success,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[2],
        marginHorizontal: spacing[4],
        marginTop: spacing[3],
        padding: spacing[3]
    },
    noticeText: {
        color: colors.success,
        flex: 1,
        fontFamily: typography.label.fontFamily,
        fontSize: 13,
        fontWeight: '700'
    },
    feedHeading: {
        color: colors.textMuted,
        fontFamily: typography.eyebrow.fontFamily,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.6,
        marginBottom: -spacing[1],
        textTransform: 'uppercase'
    },
    // ---- Feed card ----
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg + 4,
        borderWidth: 1,
        flexDirection: 'row',
        overflow: 'hidden',
        ...shadows.elevated
    },
    cardAccent: {
        width: 5
    },
    cardBody: {
        flex: 1,
        gap: spacing[3],
        padding: spacing[4]
    },
    cardTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[3]
    },
    token: {
        alignItems: 'center',
        borderRadius: radii.md + 4,
        height: 44,
        justifyContent: 'center',
        width: 44
    },
    tokenEmoji: {
        fontSize: 22
    },
    cardCategory: {
        fontFamily: typography.label.fontFamily,
        fontSize: 14,
        fontWeight: '800'
    },
    metaRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2],
        marginTop: 1
    },
    cardTime: {
        color: colors.textSubtle,
        fontFamily: typography.body.fontFamily,
        fontSize: 12
    },
    liveDot: {
        borderRadius: radii.pill,
        height: 7,
        width: 7
    },
    statusBlock: {
        gap: spacing[2]
    },
    statusWord: {
        fontFamily: typography.title.fontFamily,
        fontSize: 30,
        fontWeight: '900',
        letterSpacing: -0.5
    },
    meter: {
        flexDirection: 'row',
        gap: spacing[2]
    },
    meterSeg: {
        backgroundColor: colors.brandMuted,
        borderRadius: radii.pill,
        flex: 1,
        height: 7
    },
    cardTitle: {
        color: colors.text,
        fontFamily: typography.title.fontFamily,
        fontSize: 18,
        fontWeight: '700',
        lineHeight: 24
    },
    cardDescription: {
        color: colors.textMuted,
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
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.sm,
        flexDirection: 'row',
        gap: spacing[1],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    detailChipLabel: {
        color: colors.textSubtle,
        fontFamily: typography.label.fontFamily,
        fontSize: 12,
        fontWeight: '700'
    },
    detailChipValue: {
        color: colors.brandDark,
        fontFamily: typography.label.fontFamily,
        fontSize: 12,
        fontWeight: '700'
    },
    linkButton: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    linkButtonText: {
        color: colors.brand,
        fontFamily: typography.label.fontFamily,
        fontSize: 13,
        fontWeight: '700'
    },
    cardFooter: {
        alignItems: 'center',
        borderTopColor: colors.border,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: spacing[3]
    },
    authorChip: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: spacing[2]
    },
    avatar: {
        alignItems: 'center',
        borderRadius: radii.pill,
        height: 30,
        justifyContent: 'center',
        width: 30
    },
    avatarText: {
        fontFamily: typography.label.fontFamily,
        fontSize: 11,
        fontWeight: '800'
    },
    authorName: {
        color: colors.textMuted,
        flexShrink: 1,
        fontFamily: typography.label.fontFamily,
        fontSize: 13,
        fontWeight: '700'
    },
    confirmPill: {
        alignItems: 'center',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    confirmPillText: {
        color: colors.brand,
        fontFamily: typography.label.fontFamily,
        fontSize: 13,
        fontWeight: '700'
    },
    // ---- Live composer ----
    composerCard: {
        backgroundColor: colors.surface,
        borderColor: colors.brandMuted,
        borderRadius: radii.lg + 4,
        borderWidth: 1.5,
        gap: spacing[4],
        padding: spacing[4],
        ...shadows.elevated
    },
    composerHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[3]
    },
    composerEyebrow: {
        color: colors.brand,
        fontFamily: typography.eyebrow.fontFamily,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1
    },
    composerPrompt: {
        color: colors.text,
        fontFamily: typography.title.fontFamily,
        fontSize: 18,
        fontWeight: '800',
        lineHeight: 23,
        marginTop: 2
    },
    composerInput: {
        backgroundColor: colors.canvas,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        borderWidth: 1,
        color: colors.text,
        fontFamily: typography.body.fontFamily,
        fontSize: 15,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3]
    },
    quickRow: {
        flexDirection: 'row',
        gap: spacing[3]
    },
    quickButton: {
        alignItems: 'center',
        borderRadius: radii.md + 2,
        flex: 1,
        justifyContent: 'center',
        paddingVertical: spacing[4]
    },
    quickPositive: {
        backgroundColor: colors.success
    },
    quickNegative: {
        backgroundColor: colors.danger
    },
    quickNeutral: {
        backgroundColor: colors.brandSubtle,
        borderColor: colors.brandMuted,
        borderWidth: 1
    },
    quickButtonText: {
        color: colors.inverseText,
        fontFamily: typography.label.fontFamily,
        fontSize: 15,
        fontWeight: '800'
    },
    quickButtonTextNeutral: {
        color: colors.brand
    },
    composerFootnote: {
        color: colors.textSubtle,
        fontFamily: typography.body.fontFamily,
        fontSize: 12,
        marginTop: -spacing[2]
    },
    // ---- State ----
    stateCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg + 4,
        borderWidth: 1,
        gap: spacing[3],
        justifyContent: 'center',
        marginTop: spacing[4],
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[8]
    },
    stateEmoji: {
        fontSize: 44
    },
    stateText: {
        color: colors.textMuted,
        fontFamily: typography.body.fontFamily,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center'
    },
    // ---- FAB ----
    fab: {
        ...shadows.elevated,
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[4],
        position: 'absolute'
    },
    fabPressed: {
        opacity: 0.85
    },
    fabText: {
        color: colors.inverseText,
        fontFamily: typography.label.fontFamily,
        fontSize: 15,
        fontWeight: '800'
    },
    // ---- Compose screen ----
    composeSectionBlock: {
        gap: spacing[2]
    },
    composeSectionLabel: {
        color: colors.textSubtle,
        fontFamily: typography.eyebrow.fontFamily,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.6,
        textTransform: 'uppercase'
    },
    composer: {
        ...shadows.elevated,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg + 4,
        borderWidth: 1,
        gap: spacing[4],
        padding: spacing[5]
    },
    composerTitleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2]
    },
    composerBadgeEmoji: {
        fontSize: 20
    },
    composerTitle: {
        color: colors.brandDark,
        fontFamily: typography.title.fontFamily,
        fontSize: 17,
        fontWeight: '800'
    },
    fieldBlock: {
        gap: spacing[2]
    },
    fieldLabel: {
        color: colors.textMuted,
        fontFamily: typography.label.fontFamily,
        fontSize: 13,
        fontWeight: '700'
    },
    input: {
        backgroundColor: colors.canvas,
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        borderWidth: 1,
        color: colors.text,
        fontFamily: typography.body.fontFamily,
        fontSize: 15,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3]
    },
    inputMultiline: {
        minHeight: 84,
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
        paddingVertical: spacing[3]
    },
    selectChipText: {
        color: colors.textMuted,
        fontFamily: typography.label.fontFamily,
        fontSize: 13,
        fontWeight: '700'
    },
    selectChipTextActive: {
        color: colors.inverseText
    },
    submitButton: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.md + 2,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        paddingVertical: spacing[4]
    },
    submitButtonText: {
        color: colors.inverseText,
        fontFamily: typography.label.fontFamily,
        fontSize: 15,
        fontWeight: '800'
    },
    errorBanner: {
        backgroundColor: colors.dangerSubtle,
        borderColor: colors.dangerBorder,
        borderRadius: radii.md,
        borderWidth: 1,
        padding: spacing[3]
    },
    errorText: {
        color: colors.danger,
        fontFamily: typography.body.fontFamily,
        fontSize: 14
    },
    pressed: {
        opacity: 0.7
    },
    disabled: {
        opacity: 0.5
    }
});

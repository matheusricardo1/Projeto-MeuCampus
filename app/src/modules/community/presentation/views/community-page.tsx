import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2, ExternalLink, Info, Users } from 'lucide-react-native';
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
import type { CommunityPost, RuLevel } from '@/modules/community/domain/community-post';

type SubmitFn = (input: { body: string; authorName: string; payload?: Record<string, unknown> | null }) => Promise<void>;

export function CommunityPage({ authorName }: { authorName: string }) {
    const community = useCommunity('FILA_RU');
    const activeSection = getSectionOf(community.category);
    const activeCategory = getCategorySpec(community.category);

    const selectSection = (section: SectionSpec) => {
        const first = section.categories[0];
        if (first && first.id !== community.category) {
            hapticTap();
            community.setCategory(first.id);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.disclaimerCard}>
                <Info color={colors.brand} size={18} />
                <Text style={styles.disclaimerText}>
                    Mural colaborativo dos alunos — não são informações oficiais da UFAM. Ajude confirmando os relatos e mantendo os anúncios atualizados.
                </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
                {COMMUNITY_SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const active = section.id === activeSection.id;
                    return (
                        <Pressable
                            key={section.id}
                            onPress={() => selectSection(section)}
                            style={({ pressed }) => [styles.sectionTab, active ? styles.sectionTabActive : null, pressed ? styles.pressed : null]}
                        >
                            <Icon color={active ? colors.inverseText : colors.brand} size={16} />
                            <Text style={[styles.sectionTabText, active ? styles.sectionTabTextActive : null]}>{section.label}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {activeSection.categories.map((cat) => {
                    const active = cat.id === community.category;
                    return (
                        <Pressable
                            key={cat.id}
                            onPress={() => { hapticTap(); community.setCategory(cat.id); }}
                            style={({ pressed }) => [styles.chip, active ? styles.chipActive : null, pressed ? styles.pressed : null]}
                        >
                            <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{cat.label}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {activeCategory.kind === 'quick'
                ? <QuickComposer key={activeCategory.id} spec={activeCategory} isPosting={community.isPosting} authorName={authorName} onSubmit={community.createPost} />
                : <FormComposer key={activeCategory.id} spec={activeCategory} isPosting={community.isPosting} authorName={authorName} onSubmit={community.createPost} />}

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
                    <Text style={styles.emptyText}>Nada por aqui ainda. Seja o primeiro a compartilhar com a comunidade.</Text>
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

function QuickComposer({ spec, isPosting, authorName, onSubmit }: { spec: CategorySpec; isPosting: boolean; authorName: string; onSubmit: SubmitFn }) {
    const [value, setValue] = useState('');
    const quick = spec.quick;
    if (!quick) return null;

    const needsValue = Boolean(quick.needsFieldKey);
    const trimmed = value.trim();
    const disabled = isPosting || (needsValue && !trimmed);

    const submit = async (body: string, payload: Record<string, unknown>) => {
        hapticTap();
        try {
            await onSubmit({ body, authorName, payload });
            setValue('');
        } catch {
            // error surfaced by the hook
        }
    };

    return (
        <View style={styles.composer}>
            <Text style={styles.composerTitle}>{quick.prompt}</Text>
            {needsValue ? (
                <TextInput
                    value={value}
                    onChangeText={setValue}
                    placeholder={quick.needsFieldLabel}
                    placeholderTextColor={colors.textSubtle}
                    style={styles.input}
                    maxLength={80}
                />
            ) : null}
            <View style={styles.quickRow}>
                {quick.options(trimmed).map((option) => (
                    <Pressable
                        key={option.label}
                        disabled={disabled}
                        onPress={() => void submit(option.body, option.payload)}
                        style={({ pressed }) => [
                            styles.quickButton,
                            option.tone === 'positive' ? styles.quickButtonPositive : option.tone === 'negative' ? styles.quickButtonNegative : null,
                            pressed ? styles.pressed : null,
                            disabled ? styles.disabled : null
                        ]}
                    >
                        <Text style={[
                            styles.quickButtonText,
                            option.tone === 'positive' ? styles.quickButtonTextPositive : option.tone === 'negative' ? styles.quickButtonTextNegative : null
                        ]}>{option.label}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

function FormComposer({ spec, isPosting, authorName, onSubmit }: { spec: CategorySpec; isPosting: boolean; authorName: string; onSubmit: SubmitFn }) {
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
            await onSubmit({ body, authorName, payload });
            setValues({});
        } catch {
            // error surfaced by the hook
        }
    };

    return (
        <View style={styles.composer}>
            <Text style={styles.composerTitle}>Publicar em {spec.label}</Text>
            {fields.map((field) => (
                <FieldInput key={field.key} field={field} value={values[field.key] ?? ''} onChange={(val) => setField(field.key, val)} />
            ))}
            <Pressable
                disabled={disabled}
                onPress={() => void submit()}
                style={({ pressed }) => [styles.submitButton, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
            >
                <Text style={styles.submitButtonText}>Publicar</Text>
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
                        <Pressable
                            key={option}
                            onPress={() => { hapticTap(); onChange(option); }}
                            style={({ pressed }) => [styles.selectChip, active ? styles.selectChipActive : null, pressed ? styles.pressed : null]}
                        >
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

function PostCard({ post, onConfirm }: { post: CommunityPost; onConfirm: () => void }) {
    const spec = getCategorySpec(post.category);
    const payload = post.payload ?? {};
    const level = typeof payload.level === 'string' ? (payload.level as RuLevel) : null;
    const description = typeof payload.descricao === 'string' ? payload.descricao : null;
    const primaryKey = spec.primaryKey ?? 'titulo';

    // Detail lines: every payload field except the ones already shown (body,
    // description, and crowdsourcing internals reflected in the body).
    const detailEntries = spec.kind === 'form'
        ? (spec.fields ?? [])
            .filter((field) => field.key !== primaryKey && field.key !== 'descricao')
            .map((field) => [field.key, payload[field.key]] as const)
            .filter(([, val]) => typeof val === 'string' && val.length > 0)
        : [];

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

            {detailEntries.map(([key, val]) => (
                key === 'link' ? (
                    <Pressable key={key} onPress={() => openLink(String(val))} style={styles.linkRow}>
                        <ExternalLink color={colors.brand} size={14} />
                        <Text numberOfLines={1} style={styles.linkText}>{String(val)}</Text>
                    </Pressable>
                ) : (
                    <Text key={key} style={styles.detailLine}>
                        <Text style={styles.detailLabel}>{FIELD_LABELS[key] ? `${FIELD_LABELS[key]}: ` : ''}</Text>
                        {String(val)}
                    </Text>
                )
            ))}

            {description ? <Text style={styles.postDescription}>{description}</Text> : null}

            {spec.kind === 'quick' ? (
                <Pressable onPress={() => { hapticTap(); onConfirm(); }} style={({ pressed }) => [styles.confirmButton, pressed ? styles.pressed : null]}>
                    <CheckCircle2 color={colors.brand} size={16} />
                    <Text style={styles.confirmText}>Confirmar{post.confirmCount > 0 ? ` · ${post.confirmCount}` : ''}</Text>
                </Pressable>
            ) : null}
        </View>
    );
}

function openLink(url: string): void {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    void Linking.openURL(normalized).catch(() => undefined);
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
    sectionRow: {
        gap: spacing[2],
        paddingRight: spacing[2]
    },
    sectionTab: {
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
    sectionTabActive: {
        backgroundColor: colors.brand,
        borderColor: colors.brand
    },
    sectionTabText: {
        ...typography.label,
        color: colors.brand
    },
    sectionTabTextActive: {
        color: colors.inverseText
    },
    chipRow: {
        gap: spacing[2],
        paddingRight: spacing[2]
    },
    chip: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
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
    submitButton: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.md,
        justifyContent: 'center',
        paddingVertical: spacing[3]
    },
    submitButtonText: {
        ...typography.label,
        color: colors.inverseText,
        fontSize: 14
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
        ...typography.title,
        color: colors.text,
        fontSize: 15
    },
    detailLine: {
        ...typography.body,
        color: colors.textMuted,
        fontSize: 13
    },
    detailLabel: {
        color: colors.textSubtle,
        fontWeight: '700'
    },
    linkRow: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        gap: spacing[2]
    },
    linkText: {
        ...typography.body,
        color: colors.brand,
        fontSize: 13,
        textDecorationLine: 'underline'
    },
    postDescription: {
        ...typography.body,
        color: colors.text,
        marginTop: spacing[1]
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

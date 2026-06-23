import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { colors } from '@/presentation/design-system';
import { styles } from '@/presentation/views/workspace.styles';
import { getResponsiveCardStyle, useResponsiveLayout } from '@/presentation/views/workspace.utils';

export function PanelHeader({ loading, onRefresh, title }: { loading: boolean; onRefresh: () => Promise<void>; title: string }) {
    return (
        <View style={styles.panelHeader}>
            <Text numberOfLines={2} style={styles.panelTitle}>{title}</Text>
            <Pressable onPress={() => void onRefresh()} style={styles.iconButton}>
                {loading ? <ActivityIndicator color={colors.text} size="small" /> : <RefreshCw color={colors.text} size={18} />}
            </Pressable>
        </View>
    );
}

export function Field({
    children,
    compact = false,
    label
}: {
    children: ReactNode;
    compact?: boolean;
    label: string;
}) {
    return (
        <View style={[styles.field, compact ? styles.fieldCompact : null]}>
            <Text style={styles.fieldLabel}>{label}</Text>
            {children}
        </View>
    );
}

export function MetricCard({ label, value }: { label: string; value: string }) {
    const layout = useResponsiveLayout();

    return (
        <View style={[styles.metricCard, getResponsiveCardStyle(layout, 4)]}>
            <Text numberOfLines={1} style={styles.tileLabel}>{label}</Text>
            <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
        </View>
    );
}

export function MiniGrade({
    featured = false,
    helper,
    label,
    value
}: {
    featured?: boolean;
    helper: string;
    label: string;
    value: string;
}) {
    const layout = useResponsiveLayout();

    return (
        <View style={[styles.miniGradeCard, getResponsiveCardStyle(layout, 4), featured ? styles.miniGradeCardFeatured : null]}>
            <Text style={styles.smallCaps}>{label}</Text>
            <Text style={[styles.miniGradeValue, featured ? styles.miniGradeValueFeatured : null]}>{value}</Text>
            <Text style={styles.panelDescription}>{helper}</Text>
        </View>
    );
}

export function StatPill({ label, value }: { label: string; value: string }) {
    const layout = useResponsiveLayout();

    return (
        <View style={[styles.statPill, getResponsiveCardStyle(layout, 4)]}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.statPillValue}>{value}</Text>
        </View>
    );
}

export function EmptyState({ label, loading, onRefresh }: { label: string; loading: boolean; onRefresh: () => Promise<void> }) {
    return (
        <View style={styles.panel}>
            <Pressable disabled={loading} onPress={() => void onRefresh()} style={styles.primaryButton}>
                {loading ? <ActivityIndicator color={colors.inverseText} /> : <RefreshCw color={colors.inverseText} size={18} />}
                <Text style={styles.primaryButtonText}>{loading ? 'Carregando...' : label}</Text>
            </Pressable>
        </View>
    );
}

export function EmptyInline({ text }: { text: string }) {
    return (
        <View style={styles.emptyInline}>
            <Text style={styles.emptyInlineText}>{text}</Text>
        </View>
    );
}

export function SkeletonBlock({ height }: { height: number }) {
    return <View style={[styles.skeletonBlock, { height }]} />;
}

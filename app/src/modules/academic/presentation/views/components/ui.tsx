import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { RefreshCw } from 'lucide-react-native';
import { colors, radii } from '@/shared/design-system';
import { useLanguage } from '@/shared/i18n/language-provider';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';
import { getResponsiveCardStyle, useResponsiveLayout } from '@/modules/academic/presentation/views/workspace.utils';

export function PanelHeader({ loading, onRefresh, title }: { loading: boolean; onRefresh: () => Promise<void>; title: string }) {
    return (
        <View style={styles.panelHeader}>
            <Text numberOfLines={2} style={styles.panelTitle}>{title}</Text>
            <Pressable onPress={() => void onRefresh()} style={({ pressed }) => [styles.iconButton, pressed ? styles.pressedFeedback : null]}>
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
    const { t } = useLanguage();

    return (
        <View style={styles.panel}>
            <Pressable disabled={loading} onPress={() => void onRefresh()} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
                {loading ? <ActivityIndicator color={colors.inverseText} /> : <RefreshCw color={colors.inverseText} size={18} />}
                <Text style={styles.primaryButtonText}>{loading ? t('common.loading') : label}</Text>
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

// Shared driver so every skeleton block on screen sweeps in lockstep instead
// of each running its own independent (and visually out-of-sync) loop.
function useShimmerProgress(): Animated.Value {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let isActive = true;

        // Animated.loop's built-in reset-between-iterations is unreliable for a
        // single one-directional timing on this setup (the sweep plays once and
        // freezes) — driving each cycle manually with an explicit setValue(0)
        // before every restart keeps it looping smoothly instead.
        const runCycle = () => {
            progress.setValue(0);
            Animated.timing(progress, {
                toValue: 1,
                duration: 1100,
                easing: Easing.linear,
                useNativeDriver: true
            }).start(({ finished }) => {
                if (isActive && finished) runCycle();
            });
        };

        runCycle();
        return () => {
            isActive = false;
            progress.stopAnimation();
        };
    }, [progress]);

    return progress;
}

export function SkeletonBlock({ borderRadius, height, style }: { borderRadius?: number; height: number; style?: StyleProp<ViewStyle> }) {
    const [width, setWidth] = useState(0);
    const progress = useShimmerProgress();
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });

    return (
        <View
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            style={[styles.skeletonBlock, { height }, borderRadius !== undefined ? { borderRadius } : null, style]}
        >
            {width > 0 ? (
                <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX }] }]}>
                    <LinearGradient
                        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                        end={{ x: 1, y: 0 }}
                        start={{ x: 0, y: 0 }}
                        style={StyleSheet.absoluteFillObject}
                    />
                </Animated.View>
            ) : null}
        </View>
    );
}

export function SkeletonCircle({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
    return <SkeletonBlock borderRadius={radii.pill} height={size} style={[{ width: size }, style]} />;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({
    children,
    color = colors.brand,
    percent,
    size = 88,
    strokeWidth = 10,
    trackColor = colors.border
}: {
    children?: ReactNode;
    color?: string;
    percent: number;
    size?: number;
    strokeWidth?: number;
    trackColor?: string;
}) {
    const clamped = Math.max(0, Math.min(100, percent));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // strokeDashoffset isn't animatable on the native driver, so this one
        // fill-in animation runs on the JS thread — a single non-looping value,
        // not the repeating shimmer, so the cost is negligible.
        const animation = Animated.timing(progress, {
            toValue: clamped,
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false
        });
        animation.start();
        return () => animation.stop();
    }, [clamped, progress]);

    const strokeDashoffset = progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] });

    return (
        <View style={{ height: size, width: size }}>
            <Svg height={size} width={size}>
                <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke={trackColor} strokeWidth={strokeWidth} />
                <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    fill="none"
                    r={radius}
                    stroke={color}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    strokeWidth={strokeWidth}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
            {children ? (
                <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.progressRingCenter]}>
                    {children}
                </View>
            ) : null}
        </View>
    );
}

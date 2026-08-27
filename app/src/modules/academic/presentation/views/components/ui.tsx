import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { AlertTriangle, RefreshCw, X } from 'lucide-react-native';
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

// How long a toast stays up before it auto-dismisses on its own.
const TOAST_AUTO_DISMISS_MS = 6000;

/**
 * Global, floating error notification - one shared component instead of each
 * screen rendering its own inline error banner. Auto-dismisses after
 * TOAST_AUTO_DISMISS_MS; `message` becoming falsy (manual close, retry
 * succeeding, or the timeout calling onDismiss) always drives the same
 * fade/slide-out before unmounting, so every dismissal path looks identical.
 */
export function ErrorToast({
    bottomOffset = 24,
    message,
    onDismiss,
    onRetry,
    retryLabel
}: {
    bottomOffset?: number;
    message: string | null;
    onDismiss: () => void;
    onRetry?: () => void;
    retryLabel?: string;
}) {
    const [rendered, setRendered] = useState<string | null>(null);
    const translateY = useRef(new Animated.Value(40)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (dismissTimer.current) {
            clearTimeout(dismissTimer.current);
            dismissTimer.current = null;
        }

        if (message) {
            setRendered(message);
            translateY.setValue(40);
            opacity.setValue(0);
            Animated.parallel([
                Animated.timing(translateY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true })
            ]).start();

            dismissTimer.current = setTimeout(onDismiss, TOAST_AUTO_DISMISS_MS);
            return;
        }

        if (rendered) {
            Animated.parallel([
                Animated.timing(translateY, { toValue: 40, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true })
            ]).start(({ finished }) => {
                if (finished) setRendered(null);
            });
        }
        // rendered is read for its value-at-dismissal only, not a re-trigger condition.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message]);

    useEffect(() => () => {
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
    }, []);

    if (!rendered) return null;

    return (
        <Animated.View pointerEvents="box-none" style={[styles.toastLayer, { bottom: bottomOffset, opacity, transform: [{ translateY }] }]}>
            <View style={styles.toastCard}>
                <AlertTriangle color="#febf31" size={18} />
                <Text numberOfLines={3} style={styles.toastText}>{rendered}</Text>
                {onRetry ? (
                    <Pressable onPress={onRetry} style={({ pressed }) => [styles.toastRetryButton, pressed ? styles.pressedFeedback : null]}>
                        <Text style={styles.toastRetryText}>{retryLabel}</Text>
                    </Pressable>
                ) : null}
                <Pressable hitSlop={8} onPress={onDismiss} style={({ pressed }) => [styles.toastCloseButton, pressed ? styles.pressedFeedback : null]}>
                    <X color="rgba(255,255,255,0.7)" size={16} />
                </Pressable>
            </View>
        </Animated.View>
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
            duration: 1000,
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

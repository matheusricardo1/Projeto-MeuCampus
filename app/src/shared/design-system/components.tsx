import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fonts, radii, shadows, spacing, typography } from './tokens';

type SurfaceTone = 'default' | 'muted' | 'subtle' | 'brand';
type TextTone = 'default' | 'muted' | 'inverse' | 'brand' | 'danger';
type TextVariant = 'title' | 'body' | 'label' | 'eyebrow';
type ButtonTone = 'primary' | 'secondary';

export function Surface({
    children,
    style,
    tone = 'default'
}: {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
    tone?: SurfaceTone;
}) {
    return <View style={[componentStyles.surface, surfaceToneStyle[tone], style]}>{children}</View>;
}

export function AppText({
    children,
    style,
    tone = 'default',
    variant = 'body',
    ...props
}: TextProps & {
    children: ReactNode;
    style?: StyleProp<TextStyle>;
    tone?: TextTone;
    variant?: TextVariant;
}) {
    return (
        <Text {...props} style={[textVariantStyle[variant], textToneStyle[tone], style]}>
            {children}
        </Text>
    );
}

export function Button({
    children,
    disabled,
    leftIcon,
    style,
    textStyle,
    tone = 'primary',
    ...props
}: PressableProps & {
    children: ReactNode;
    leftIcon?: ReactNode;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    tone?: ButtonTone;
}) {
    const isPrimary = tone === 'primary';

    return (
        <Pressable disabled={disabled} {...props} style={[componentStyles.button, isPrimary ? componentStyles.buttonPrimary : componentStyles.buttonSecondary, disabled ? componentStyles.disabled : null, style]}>
            {leftIcon}
            <Text style={[componentStyles.buttonText, isPrimary ? componentStyles.buttonTextPrimary : componentStyles.buttonTextSecondary, textStyle]}>{children}</Text>
        </Pressable>
    );
}

export function IconAction({
    children,
    disabled,
    style,
    ...props
}: PressableProps & {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}) {
    return (
        <Pressable disabled={disabled} {...props} style={[componentStyles.iconAction, disabled ? componentStyles.disabled : null, style]}>
            {children}
        </Pressable>
    );
}

const surfaceToneStyle = StyleSheet.create({
    default: {
        backgroundColor: colors.surface
    },
    muted: {
        backgroundColor: colors.surfaceMuted
    },
    subtle: {
        backgroundColor: colors.surfaceSubtle
    },
    brand: {
        backgroundColor: colors.brandSubtle
    }
});

const textVariantStyle = StyleSheet.create({
    title: {
        ...typography.title
    },
    body: {
        ...typography.body
    },
    label: {
        ...typography.label
    },
    eyebrow: {
        ...typography.eyebrow,
        textTransform: 'uppercase'
    }
});

const textToneStyle = StyleSheet.create({
    default: {
        color: colors.text
    },
    muted: {
        color: colors.textMuted
    },
    inverse: {
        color: colors.inverseText
    },
    brand: {
        color: colors.brand
    },
    danger: {
        color: colors.danger
    }
});

const componentStyles = StyleSheet.create({
    surface: {
        ...shadows.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[4],
        padding: spacing[5]
    },
    button: {
        alignItems: 'center',
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: spacing[4]
    },
    buttonPrimary: {
        backgroundColor: colors.brand
    },
    buttonSecondary: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderWidth: 1
    },
    buttonText: {
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '700'
    },
    buttonTextPrimary: {
        color: colors.inverseText
    },
    buttonTextSecondary: {
        color: colors.brand
    },
    disabled: {
        opacity: 0.6
    },
    iconAction: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        height: 42,
        justifyContent: 'center',
        width: 42
    }
});

import type { ComponentType } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart3, BookOpen, CalendarClock, Sparkles, X } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '@/shared/design-system';

type Feature = {
    Icon: ComponentType<{ color?: string; size?: number }>;
    title: string;
    description: string;
};

const FEATURES: Feature[] = [
    {
        Icon: BarChart3,
        title: 'Notas e faltas na hora',
        description: 'Pergunte sua média, frequência ou o que falta para passar.'
    },
    {
        Icon: CalendarClock,
        title: 'Sua próxima aula',
        description: 'Descubra o que vem a seguir sem abrir o horário.'
    },
    {
        Icon: BookOpen,
        title: 'Plano de ensino sem enrolação',
        description: 'Tire dúvidas sobre o conteúdo de qualquer disciplina.'
    }
];

export function AiOnboardingModal({ onDismiss, visible }: { onDismiss: () => void; visible: boolean }) {
    return (
        <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={visible}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <Pressable onPress={onDismiss} style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}>
                        <X color={colors.textMuted} size={18} />
                    </Pressable>

                    <View style={styles.iconBadge}>
                        <Sparkles color={colors.inverseText} size={26} />
                    </View>

                    <Text style={styles.title}>A IA que conhece sua vida acadêmica</Text>
                    <Text style={styles.subtitle}>Pergunte qualquer coisa sobre suas notas, faltas, horários ou disciplinas — sem precisar procurar em nenhuma tela.</Text>

                    <View style={styles.featureList}>
                        {FEATURES.map(({ Icon, title, description }) => (
                            <View key={title} style={styles.featureRow}>
                                <View style={styles.featureIconBadge}>
                                    <Icon color={colors.brand} size={18} />
                                </View>
                                <View style={styles.featureTextStack}>
                                    <Text style={styles.featureTitle}>{title}</Text>
                                    <Text style={styles.featureDescription}>{description}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <Pressable onPress={onDismiss} style={({ pressed }) => [styles.ctaButton, pressed ? styles.pressed : null]}>
                        <Text style={styles.ctaText}>Vamos começar</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(11, 61, 50, 0.55)',
        flex: 1,
        justifyContent: 'center',
        padding: spacing[5]
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: radii.md + 8,
        gap: spacing[2],
        maxWidth: 380,
        padding: spacing[6],
        position: 'relative',
        width: '100%'
    },
    closeButton: {
        alignItems: 'center',
        height: 32,
        justifyContent: 'center',
        position: 'absolute',
        right: spacing[3],
        top: spacing[3],
        width: 32,
        zIndex: 1
    },
    iconBadge: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.pill,
        height: 56,
        justifyContent: 'center',
        marginBottom: spacing[2],
        width: 56
    },
    title: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 21,
        fontWeight: '800',
        lineHeight: 27
    },
    subtitle: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: spacing[3]
    },
    featureList: {
        gap: spacing[3],
        marginBottom: spacing[5]
    },
    featureRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: spacing[3]
    },
    featureIconBadge: {
        alignItems: 'center',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.md,
        height: 36,
        justifyContent: 'center',
        width: 36
    },
    featureTextStack: {
        flex: 1,
        gap: 2,
        minWidth: 0
    },
    featureTitle: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 14.5,
        fontWeight: '800'
    },
    featureDescription: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 13,
        lineHeight: 18
    },
    ctaButton: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.md,
        justifyContent: 'center',
        minHeight: 50,
        paddingHorizontal: spacing[4]
    },
    ctaText: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '800'
    },
    pressed: {
        opacity: 0.7
    }
});

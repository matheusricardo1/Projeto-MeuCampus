import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText, X } from 'lucide-react-native';
import { useLanguage } from '@/shared/i18n/language-provider';
import { colors, fonts, radii, spacing } from '@/shared/design-system';

// The eCampus portal has no scraped declarations endpoint yet (see
// use-ecampus-workspace.ts), so this list is a static preview of the
// document types students can request — not wired to real generation/download.
const DECLARATION_KEYS = [
    'declarations.entranceApproval',
    'declarations.academicPerformance',
    'declarations.institutionalEnrollment',
    'declarations.finalist',
    'declarations.courseCompletion',
    'declarations.libraryClearance',
    'declarations.libraryClearanceDropout',
    'declarations.universityRestaurant',
    'declarations.institutional',
    'declarations.semesterEnrollment'
] as const;

export function DeclarationsModal({ onClose, visible }: { onClose: () => void; visible: boolean }) {
    const { t } = useLanguage();

    return (
        <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
            <Pressable onPress={onClose} style={styles.overlay}>
                <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t('declarations.title')}</Text>
                        <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}>
                            <X color={colors.textMuted} size={18} />
                        </Pressable>
                    </View>
                    <Text style={styles.subtitle}>{t('declarations.subtitle')}</Text>

                    <View style={styles.optionList}>
                        {DECLARATION_KEYS.map((key) => (
                            <View key={key} style={styles.option}>
                                <View style={styles.optionIcon}>
                                    <FileText color={colors.brand} size={18} />
                                </View>
                                <Text style={styles.optionLabel}>{t(key)}</Text>
                                <View style={styles.comingSoonBadge}>
                                    <Text style={styles.comingSoonBadgeText}>{t('declarations.comingSoon')}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        backgroundColor: 'rgba(11, 61, 50, 0.55)',
        flex: 1,
        justifyContent: 'flex-end'
    },
    sheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: radii.md + 10,
        borderTopRightRadius: radii.md + 10,
        gap: spacing[3],
        maxHeight: '82%',
        paddingBottom: spacing[7],
        paddingHorizontal: spacing[5],
        paddingTop: spacing[5]
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    title: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 17,
        fontWeight: '800'
    },
    subtitle: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 13,
        lineHeight: 18,
        marginTop: -6
    },
    closeButton: {
        alignItems: 'center',
        height: 28,
        justifyContent: 'center',
        width: 28
    },
    optionList: {
        gap: spacing[2]
    },
    option: {
        alignItems: 'center',
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing[3],
        padding: spacing[3]
    },
    optionIcon: {
        alignItems: 'center',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.pill,
        height: 36,
        justifyContent: 'center',
        width: 36
    },
    optionLabel: {
        color: colors.text,
        flex: 1,
        fontFamily: fonts.medium,
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 19
    },
    comingSoonBadge: {
        backgroundColor: colors.warningSubtle,
        borderRadius: radii.pill,
        flexShrink: 0,
        paddingHorizontal: 8,
        paddingVertical: 4
    },
    comingSoonBadgeText: {
        color: colors.warning,
        fontFamily: fonts.medium,
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0,
        textTransform: 'uppercase'
    },
    pressed: {
        opacity: 0.7
    }
});

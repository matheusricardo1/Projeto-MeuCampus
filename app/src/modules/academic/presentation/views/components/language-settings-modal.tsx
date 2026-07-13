import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { LANGUAGE_OPTIONS, type LanguageCode } from '@/shared/i18n/languages';
import { useLanguage } from '@/shared/i18n/language-provider';
import { colors, fonts, radii, spacing } from '@/shared/design-system';
import { LanguageFlag } from '@/modules/academic/presentation/views/components/language-selector';

// A Modal-based language picker for the settings/profile screen. The inline
// dropdown in language-selector.tsx works fine on the (short, static) login
// page, but on mobile it's an absolutely-positioned panel living inside a
// ScrollView with a lower z-index than the bottom tab bar — it gets clipped
// and rendered underneath the nav. A Modal renders in its own native layer
// above everything, which sidesteps both problems entirely.
export function LanguageSettingsModal({ onClose, visible }: { onClose: () => void; visible: boolean }) {
    const { language, setLanguage, t } = useLanguage();

    const changeLanguage = (nextLanguage: LanguageCode) => {
        setLanguage(nextLanguage);
        onClose();
    };

    return (
        <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
            <Pressable onPress={onClose} style={styles.overlay}>
                <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t('language.selectorLabel')}</Text>
                        <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}>
                            <X color={colors.textMuted} size={18} />
                        </Pressable>
                    </View>

                    <View style={styles.optionList}>
                        {LANGUAGE_OPTIONS.map((option) => {
                            const active = option.code === language;
                            return (
                                <Pressable
                                    key={option.code}
                                    onPress={() => changeLanguage(option.code)}
                                    style={({ pressed }) => [styles.option, active ? styles.optionActive : null, pressed ? styles.pressed : null]}
                                >
                                    <LanguageFlag code={option.code} />
                                    <View style={styles.optionTextStack}>
                                        <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>{option.nativeLabel}</Text>
                                        <Text style={styles.optionMeta}>{option.label}</Text>
                                    </View>
                                    {active ? <Check color={colors.brandDark} size={18} /> : null}
                                </Pressable>
                            );
                        })}
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
        borderColor: 'transparent',
        borderRadius: radii.md,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: spacing[3],
        padding: spacing[3]
    },
    optionActive: {
        backgroundColor: colors.brandSubtle,
        borderColor: colors.brand
    },
    optionTextStack: {
        flex: 1,
        gap: 1,
        minWidth: 0
    },
    optionLabel: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '700'
    },
    optionLabelActive: {
        color: colors.brandDark
    },
    optionMeta: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 12
    },
    pressed: {
        opacity: 0.7
    }
});

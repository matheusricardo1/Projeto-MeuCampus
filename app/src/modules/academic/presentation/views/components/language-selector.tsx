import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { LANGUAGE_OPTIONS, type LanguageCode } from '@/shared/i18n/languages';
import { useLanguage } from '@/shared/i18n/language-provider';
import { colors } from '@/shared/design-system';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';

export function LanguageSelector({ compact = false, onBrand = false }: { compact?: boolean; onBrand?: boolean }) {
    const [open, setOpen] = useState(false);
    const { language, languageOption, setLanguage, t } = useLanguage();

    const changeLanguage = (nextLanguage: LanguageCode) => {
        setLanguage(nextLanguage);
        setOpen(false);
    };

    return (
        <View style={[styles.languageSelector, compact ? styles.languageSelectorCompact : null]}>
            <Pressable
                accessibilityLabel={t('language.selectorLabel')}
                onPress={() => setOpen((current) => !current)}
                style={[styles.languageSelectorButton, onBrand ? styles.languageSelectorButtonOnBrand : null]}
            >
                <LanguageFlag code={languageOption.code} />
                <View style={styles.languageSelectorTextBlock}>
                    <Text style={[styles.languageSelectorLabel, onBrand ? styles.languageSelectorLabelOnBrand : null]}>{t('language.selectorLabel')}</Text>
                    <Text numberOfLines={1} style={[styles.languageSelectorValue, onBrand ? styles.languageSelectorValueOnBrand : null]}>{languageOption.nativeLabel}</Text>
                </View>
                <ChevronDown color={onBrand ? colors.brandMuted : colors.textMuted} size={17} />
            </Pressable>

            {open ? (
                <View style={styles.languageSelectorMenu}>
                    {LANGUAGE_OPTIONS.map((option) => {
                        const active = option.code === language;
                        return (
                            <Pressable
                                key={option.code}
                                onPress={() => changeLanguage(option.code)}
                                style={[styles.languageSelectorOption, active ? styles.languageSelectorOptionActive : null]}
                            >
                                <LanguageFlag code={option.code} />
                                <View style={styles.languageSelectorTextBlock}>
                                    <Text style={[styles.languageSelectorOptionText, active ? styles.languageSelectorOptionTextActive : null]}>{option.nativeLabel}</Text>
                                    <Text style={styles.languageSelectorOptionMeta}>{option.label}</Text>
                                </View>
                                {active ? <Check color={colors.brandDark} size={17} /> : null}
                            </Pressable>
                        );
                    })}
                </View>
            ) : null}
        </View>
    );
}

function LanguageFlag({ code }: { code: LanguageCode }) {
    if (code === 'pt-BR') {
        return (
            <View style={[styles.languageFlag, styles.languageFlagBrazil]}>
                <View style={styles.languageFlagBrazilDiamond} />
                <View style={styles.languageFlagBrazilCircle} />
            </View>
        );
    }

    if (code === 'en') {
        return (
            <View style={styles.languageFlag}>
                <View style={styles.languageFlagUsCanton} />
                <View style={styles.languageFlagUsStripeRed} />
                <View style={styles.languageFlagUsStripeWhite} />
                <View style={styles.languageFlagUsStripeRed} />
                <View style={styles.languageFlagUsStripeWhite} />
                <View style={styles.languageFlagUsStripeRed} />
            </View>
        );
    }

    if (code === 'es') {
        return (
            <View style={styles.languageFlag}>
                <View style={styles.languageFlagSpainRed} />
                <View style={styles.languageFlagSpainYellow} />
                <View style={styles.languageFlagSpainRed} />
            </View>
        );
    }

    return (
        <View style={styles.languageFlagHorizontal}>
            <View style={styles.languageFlagFranceBlue} />
            <View style={styles.languageFlagFranceWhite} />
            <View style={styles.languageFlagFranceRed} />
        </View>
    );
}

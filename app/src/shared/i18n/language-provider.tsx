import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, getLanguageOption, translations, type LanguageCode, type LanguageOption, type Translate, type TranslationKey, type TranslationValues } from '@/shared/i18n/languages';
import { readStoredLanguage, writeStoredLanguage } from '@/shared/i18n/language-store';

type LanguageContextValue = {
    language: LanguageCode;
    languageOption: LanguageOption;
    setLanguage: (language: LanguageCode) => void;
    t: Translate;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);

    useEffect(() => {
        let active = true;

        void readStoredLanguage().then((storedLanguage) => {
            if (active) setLanguageState(storedLanguage);
        });

        return () => {
            active = false;
        };
    }, []);

    const setLanguage = useCallback((nextLanguage: LanguageCode) => {
        setLanguageState(nextLanguage);
        void writeStoredLanguage(nextLanguage);
    }, []);

    const t = useCallback((key: TranslationKey, values?: TranslationValues) => {
        return formatTranslation(translations[language][key] || translations[DEFAULT_LANGUAGE][key], values);
    }, [language]);

    const value = useMemo<LanguageContextValue>(() => ({
        language,
        languageOption: getLanguageOption(language),
        setLanguage,
        t
    }), [language, setLanguage, t]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage(): LanguageContextValue {
    const value = useContext(LanguageContext);
    if (value) {
        return value;
    }

    return {
        language: DEFAULT_LANGUAGE,
        languageOption: getLanguageOption(DEFAULT_LANGUAGE),
        setLanguage: () => undefined,
        t: (key, values) => formatTranslation(translations[DEFAULT_LANGUAGE][key], values)
    };
}

function formatTranslation(template: string, values?: TranslationValues): string {
    if (!values) return template;

    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = values[name];
        return value === undefined ? match : String(value);
    });
}

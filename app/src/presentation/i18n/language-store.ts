import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from '@/presentation/i18n/languages';

const STORAGE_KEY = 'meu-campus.language';
let cachedLanguage: LanguageCode = DEFAULT_LANGUAGE;

function hasLocalStorage(): boolean {
    return typeof localStorage !== 'undefined';
}

export async function readStoredLanguage(): Promise<LanguageCode> {
    try {
        const rawValue = hasLocalStorage()
            ? localStorage.getItem(STORAGE_KEY)
            : await readNativeStoredLanguage();

        if (rawValue && isLanguageCode(rawValue)) {
            cachedLanguage = rawValue;
            return rawValue;
        }
    } catch {
        return cachedLanguage;
    }

    return DEFAULT_LANGUAGE;
}

export async function writeStoredLanguage(language: LanguageCode): Promise<void> {
    cachedLanguage = language;

    try {
        if (hasLocalStorage()) {
            localStorage.setItem(STORAGE_KEY, language);
            return;
        }

        await writeNativeStoredLanguage(language);
    } catch {
        // The in-memory language has already been updated; persistence can fail silently.
    }
}

async function readNativeStoredLanguage(): Promise<string | null> {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    return AsyncStorage.getItem(STORAGE_KEY);
}

async function writeNativeStoredLanguage(language: LanguageCode): Promise<void> {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(STORAGE_KEY, language);
}

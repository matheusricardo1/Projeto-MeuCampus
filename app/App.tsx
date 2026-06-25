import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from '@/presentation/i18n/language-provider';
import { Workspace } from '@/presentation/views/workspace';

export default function App() {
    return (
        <LanguageProvider>
            <SafeAreaProvider>
                <StatusBar style="dark" />
                <Workspace />
            </SafeAreaProvider>
        </LanguageProvider>
    );
}

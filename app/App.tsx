import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Workspace } from '@/presentation/views/workspace';

export default function App() {
    return (
        <SafeAreaProvider>
            <StatusBar style="dark" />
            <Workspace />
        </SafeAreaProvider>
    );
}

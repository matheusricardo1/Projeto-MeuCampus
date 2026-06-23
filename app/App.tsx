import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EcampusWorkspace } from '@/presentation/views/ecampus-workspace';

export default function App() {
    return (
        <SafeAreaProvider>
            <StatusBar style="dark" />
            <EcampusWorkspace />
        </SafeAreaProvider>
    );
}

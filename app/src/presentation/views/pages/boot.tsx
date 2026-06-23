import { ActivityIndicator, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LockKeyhole } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients } from '@/presentation/design-system';
import { styles } from '@/presentation/views/workspace.styles';
import { useResponsiveLayout } from '@/presentation/views/workspace.utils';

export function BootPage() {
    const layout = useResponsiveLayout();

    return (
        <SafeAreaView style={styles.bootScreen}>
            <LinearGradient colors={gradients.brand} style={[styles.bootCard, { maxWidth: layout.isTablet ? 560 : 420 }]}>
                <LockKeyhole color={colors.brandMuted} size={28} />
                <Text style={styles.bootTitle}>Meu Campus</Text>
                <Text style={styles.bootText}>Carregando dados academicos...</Text>
                <ActivityIndicator color={colors.brandMuted} />
            </LinearGradient>
        </SafeAreaView>
    );
}

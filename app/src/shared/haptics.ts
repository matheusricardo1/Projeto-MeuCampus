import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// expo-haptics is a no-op on web, but Platform-gating avoids even attempting
// the native bridge call there.
export function hapticTap(): void {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticConfirm(): void {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

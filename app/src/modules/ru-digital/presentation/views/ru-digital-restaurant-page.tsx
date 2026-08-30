import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { colors } from '@/shared/design-system';
import { SkeletonBlock } from '@/modules/academic/presentation/views/components';
import { useRuDigitalRestaurants } from '@/modules/ru-digital/presentation/hooks/use-ru-digital-restaurants';
import { ruDigitalStyles as styles } from '@/modules/ru-digital/presentation/views/ru-digital.styles';

export function RuDigitalRestaurantPage() {
    const router = useRouter();
    const { error, isLoading, isSelecting, restaurants, selectRestaurant } = useRuDigitalRestaurants();
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const handleSelect = async (restaurantId: string) => {
        setSelectedId(restaurantId);
        const ok = await selectRestaurant(restaurantId);
        if (ok) {
            router.back();
        } else {
            setSelectedId(null);
        }
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>Selecione um restaurante</Text>
                <Text style={styles.subtitle}>Em qual restaurante universitario voce deseja realizar as operacoes</Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {isLoading ? (
                <View style={styles.restaurantList}>
                    {[0, 1, 2, 3].map((index) => (
                        <SkeletonBlock height={60} key={index} style={{ width: '100%' }} />
                    ))}
                </View>
            ) : (
                <View style={styles.restaurantList}>
                    {restaurants.map((item) => {
                        const isSelected = selectedId === item.id;
                        return (
                            <Pressable
                                disabled={isSelecting}
                                key={item.id}
                                onPress={() => void handleSelect(item.id)}
                                style={[styles.restaurantOption, isSelected ? styles.restaurantOptionSelected : null]}
                            >
                                <Text style={styles.restaurantOptionText}>{item.city}</Text>
                                {isSelected && isSelecting ? (
                                    <ActivityIndicator color={colors.brand} size="small" />
                                ) : isSelected ? (
                                    <Check color={colors.brand} size={18} />
                                ) : null}
                            </Pressable>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CupSoda, Soup, UtensilsCrossed } from 'lucide-react-native';
import { colors } from '@/shared/design-system';
import { SkeletonBlock } from '@/modules/academic/presentation/views/components';
import { useRuDigitalDashboard } from '@/modules/ru-digital/presentation/hooks/use-ru-digital-dashboard';
import type { RuDigitalMealBalance } from '@/modules/ru-digital/domain/entities/balance';
import { ruDigitalStyles as styles } from '@/modules/ru-digital/presentation/views/ru-digital.styles';

function formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function RuDigitalDashboardPage() {
    const router = useRouter();
    const { balance, dailyMenu, error, isLinked, isLoading, needsRestaurantSelection, restaurant, student } = useRuDigitalDashboard();

    if (!isLinked) {
        return (
            <View style={styles.screen}>
                <View style={styles.emptyCard}>
                    <UtensilsCrossed color={colors.textMuted} size={40} />
                    <Text style={styles.emptyTitle}>RU Digital nao conectado</Text>
                    <Text style={styles.emptyText}>Nao foi possivel conectar ao RU Digital com sua conta. Saia e entre novamente para tentar de novo.</Text>
                </View>
            </View>
        );
    }

    if (isLoading) {
        return <RuDigitalDashboardSkeleton />;
    }

    if (needsRestaurantSelection) {
        return (
            <View style={styles.screen}>
                <View style={styles.emptyCard}>
                    <UtensilsCrossed color={colors.brand} size={40} />
                    <Text style={styles.emptyTitle}>Escolha seu restaurante</Text>
                    <Text style={styles.emptyText}>Selecione o Restaurante Universitario que voce frequenta para ver seu saldo e o cardapio.</Text>
                    <Pressable onPress={() => router.push('/ru-digital/restaurant')} style={styles.primaryButton}>
                        <Text style={styles.primaryButtonText}>Selecionar restaurante</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>RU Digital</Text>
                <Text style={styles.subtitle}>{student ? `Ola, ${student.fullName.split(/\s+/)[0]}` : 'Bandejao'}</Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Saldo</Text>
                <View style={styles.balanceRow}>
                    <BalanceCard Icon={CupSoda} label="Desjejum" meal={balance?.breakfast} />
                    <BalanceCard Icon={UtensilsCrossed} label="Almoco" meal={balance?.lunch} />
                    <BalanceCard Icon={Soup} label="Jantar" meal={balance?.dinner} />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cardapio de hoje</Text>
                <View style={styles.menuCard}>
                    {dailyMenu && dailyMenu.items.length > 0 ? (
                        dailyMenu.items.map((item, index) => (
                            <View key={index} style={styles.menuItemRow}>
                                <Text style={styles.menuItemBullet}>{'•'}</Text>
                                <Text style={styles.menuItemText}>{item}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.menuEmptyText}>Cardapio indisponivel para hoje.</Text>
                    )}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Restaurante</Text>
                <View style={styles.restaurantCard}>
                    <View style={styles.restaurantTextStack}>
                        <Text style={styles.restaurantLabel}>Padrao</Text>
                        <Text style={styles.restaurantName}>{restaurant?.name ?? '-'}</Text>
                    </View>
                    <Pressable onPress={() => router.push('/ru-digital/restaurant')} style={styles.restaurantChangeButton}>
                        <Text style={styles.restaurantChangeButtonText}>Trocar</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

function BalanceCard({ Icon, label, meal }: { Icon: typeof CupSoda; label: string; meal?: RuDigitalMealBalance }) {
    return (
        <View style={styles.balanceCard}>
            <Icon color={colors.brand} size={20} />
            <Text style={styles.balanceMealLabel}>{label}</Text>
            <Text style={styles.balanceCount}>{meal ? meal.availableForPurchase : '-'}</Text>
            <Text style={styles.balancePrice}>{meal ? formatCurrency(meal.mealPrice) : '--'}</Text>
        </View>
    );
}

function RuDigitalDashboardSkeleton() {
    return (
        <View style={styles.screen}>
            <View style={[styles.header, { gap: 6 }]}>
                <SkeletonBlock height={22} style={{ width: '40%' }} />
                <SkeletonBlock height={14} style={{ width: '60%' }} />
            </View>
            <View style={styles.balanceRow}>
                {[0, 1, 2].map((index) => (
                    <View key={index} style={[styles.balanceCard, { gap: 8 }]}>
                        <SkeletonBlock height={20} style={{ width: 20 }} />
                        <SkeletonBlock height={12} style={{ width: '70%' }} />
                        <SkeletonBlock height={22} style={{ width: '40%' }} />
                    </View>
                ))}
            </View>
            <SkeletonBlock height={100} style={{ width: '100%' }} />
            <SkeletonBlock height={72} style={{ width: '100%' }} />
        </View>
    );
}

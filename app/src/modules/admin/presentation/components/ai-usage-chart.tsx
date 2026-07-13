import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/shared/design-system';
import type { AiUsageToday } from '@/modules/admin/infrastructure/admin-api';

const BAR_MAX_HEIGHT = 84;
const BAR_MIN_HEIGHT = 3;

function formatHourLabel(iso: string): string {
    return `${new Date(iso).getHours().toString().padStart(2, '0')}h`;
}

function rpdStatusColor(requests: number, rpd: number): string {
    const ratio = rpd > 0 ? requests / rpd : 0;
    if (ratio >= 1) return colors.danger;
    if (ratio >= 0.7) return colors.warning;
    return colors.success;
}

export function AiUsageChart({ usage }: { usage: AiUsageToday }) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const maxRequests = Math.max(...usage.hourly.map((point) => point.requests), 1);
    const statusColor = rpdStatusColor(usage.totals.requests, usage.freeTierLimits.rpd);
    const selected = selectedIndex !== null ? usage.hourly[selectedIndex] : null;

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.title}>Uso de IA hoje</Text>
                    <Text style={styles.subtitle}>Mensagens por hora (nivel gratuito Gemini)</Text>
                </View>
                <View style={[styles.rpdBadge, { backgroundColor: `${statusColor}1A` }]}>
                    <View style={[styles.rpdDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.rpdBadgeText, { color: statusColor }]}>
                        {usage.totals.requests}/{usage.freeTierLimits.rpd} RPD
                    </Text>
                </View>
            </View>

            <View style={styles.chartArea}>
                {usage.hourly.map((point, index) => {
                    const height = point.requests > 0
                        ? Math.max(BAR_MIN_HEIGHT, (point.requests / maxRequests) * BAR_MAX_HEIGHT)
                        : BAR_MIN_HEIGHT;
                    const isSelected = selectedIndex === index;
                    const showLabel = index % 4 === 0;

                    return (
                        <Pressable
                            key={point.hour}
                            onPress={() => setSelectedIndex(isSelected ? null : index)}
                            style={styles.barColumn}
                        >
                            <View style={styles.barTrack}>
                                <View
                                    style={[
                                        styles.bar,
                                        { height, backgroundColor: isSelected ? colors.brandDark : colors.brand }
                                    ]}
                                />
                            </View>
                            <Text numberOfLines={1} style={styles.barLabel}>{showLabel ? formatHourLabel(point.hour) : ''}</Text>
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.detailRow}>
                {selected ? (
                    <Text style={styles.detailText}>
                        {formatHourLabel(selected.hour)} - {selected.requests} {selected.requests === 1 ? 'mensagem' : 'mensagens'} - {selected.inputTokens + selected.outputTokens} tokens
                    </Text>
                ) : (
                    <Text style={styles.detailHint}>Toque em uma barra para ver os detalhes da hora</Text>
                )}
            </View>

            <View style={styles.statsRow}>
                <Text style={styles.statText}>TPM limite: {(usage.freeTierLimits.tpm / 1000).toFixed(0)}k</Text>
                <Text style={styles.statText}>RPM limite: {usage.freeTierLimits.rpm}</Text>
                <Text style={styles.statText}>Tokens hoje: {usage.totals.inputTokens + usage.totals.outputTokens}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[3],
        padding: spacing[4]
    },
    headerRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    title: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '800'
    },
    subtitle: {
        color: colors.textSubtle,
        fontFamily: fonts.sans,
        fontSize: 11.5,
        marginTop: 2
    },
    rpdBadge: {
        alignItems: 'center',
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5
    },
    rpdDot: {
        borderRadius: radii.pill,
        height: 6,
        width: 6
    },
    rpdBadgeText: {
        fontFamily: fonts.medium,
        fontSize: 11,
        fontWeight: '800'
    },
    chartArea: {
        alignItems: 'flex-end',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 2,
        paddingBottom: spacing[1]
    },
    barColumn: {
        alignItems: 'center',
        flex: 1,
        gap: 4
    },
    barTrack: {
        height: BAR_MAX_HEIGHT,
        justifyContent: 'flex-end',
        width: '100%'
    },
    bar: {
        alignSelf: 'center',
        borderRadius: radii.xs,
        width: '55%'
    },
    barLabel: {
        color: colors.textSubtle,
        fontFamily: fonts.sans,
        fontSize: 9
    },
    detailRow: {
        minHeight: 16
    },
    detailText: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 12.5,
        fontWeight: '700'
    },
    detailHint: {
        color: colors.textSubtle,
        fontFamily: fonts.sans,
        fontSize: 11.5
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[3]
    },
    statText: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 11.5
    }
});

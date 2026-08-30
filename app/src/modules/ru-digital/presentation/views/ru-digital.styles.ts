import { StyleSheet } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '@/shared/design-system';

export const ruDigitalStyles = StyleSheet.create({
    screen: {
        flexDirection: 'column',
        gap: spacing[6]
    },
    header: {
        flexDirection: 'column',
        gap: spacing[1]
    },
    title: {
        ...typography.title,
        color: colors.text
    },
    subtitle: {
        ...typography.body,
        color: colors.textMuted
    },
    section: {
        flexDirection: 'column',
        gap: spacing[3]
    },
    sectionHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    sectionTitle: {
        ...typography.eyebrow,
        color: colors.textMuted,
        textTransform: 'uppercase'
    },
    sectionAction: {
        ...typography.label,
        color: colors.brand
    },
    balanceRow: {
        flexDirection: 'row',
        gap: spacing[3]
    },
    balanceCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        flex: 1,
        gap: spacing[1],
        padding: spacing[4],
        ...shadows.surface
    },
    balanceMealLabel: {
        ...typography.label,
        color: colors.textMuted
    },
    balanceCount: {
        color: colors.brandDark,
        fontSize: 24,
        fontWeight: '700'
    },
    balancePrice: {
        color: colors.textSubtle,
        fontSize: 12
    },
    menuCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        gap: spacing[2],
        padding: spacing[4],
        ...shadows.surface
    },
    menuMealLabel: {
        ...typography.label,
        color: colors.brand
    },
    menuEmptyText: {
        ...typography.body,
        color: colors.textMuted
    },
    menuItemRow: {
        flexDirection: 'row',
        gap: spacing[2]
    },
    menuItemBullet: {
        color: colors.brand
    },
    menuItemText: {
        ...typography.body,
        color: colors.text,
        flex: 1
    },
    restaurantCard: {
        alignItems: 'center',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.lg,
        flexDirection: 'row',
        gap: spacing[3],
        justifyContent: 'space-between',
        padding: spacing[4]
    },
    restaurantTextStack: {
        flexDirection: 'column',
        gap: 2
    },
    restaurantLabel: {
        ...typography.label,
        color: colors.brand
    },
    restaurantName: {
        color: colors.brandDark,
        fontSize: 16,
        fontWeight: '700'
    },
    restaurantChangeButton: {
        backgroundColor: colors.surface,
        borderColor: colors.brand,
        borderRadius: radii.pill,
        borderWidth: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1]
    },
    restaurantChangeButtonText: {
        color: colors.brand,
        fontSize: 12,
        fontWeight: '700'
    },
    emptyCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        gap: spacing[3],
        padding: spacing[6]
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'center'
    },
    emptyText: {
        ...typography.body,
        color: colors.textMuted,
        textAlign: 'center'
    },
    primaryButton: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.pill,
        justifyContent: 'center',
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[3]
    },
    primaryButtonText: {
        color: colors.inverseText,
        fontSize: 14,
        fontWeight: '700'
    },
    restaurantList: {
        flexDirection: 'column',
        gap: spacing[2]
    },
    restaurantOption: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[3],
        justifyContent: 'space-between',
        padding: spacing[4]
    },
    restaurantOptionSelected: {
        backgroundColor: colors.brandSubtle,
        borderColor: colors.brand
    },
    restaurantOptionText: {
        color: colors.text,
        flex: 1,
        fontSize: 14,
        fontWeight: '600'
    },
    errorText: {
        ...typography.body,
        color: colors.danger,
        textAlign: 'center'
    }
});

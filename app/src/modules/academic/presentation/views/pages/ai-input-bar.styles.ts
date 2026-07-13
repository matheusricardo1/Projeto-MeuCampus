import { StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/shared/design-system';

// Shared between the real AI chat input dock (ai.tsx) and the fake input bar
// shown during the tab-launch transition (app/(tabs)/_layout.tsx) — a single
// source of truth so the transition bar can never visually drift from the
// real one it's standing in for.
export const aiInputBarStyles = StyleSheet.create({
    inputBar: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2],
        maxWidth: 640,
        width: '100%'
    },
    inputShell: {
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderColor: '#c0c9be',
        borderRadius: 18,
        borderWidth: 1,
        elevation: 18,
        flex: 1,
        flexDirection: 'row',
        gap: 10,
        minHeight: 52,
        overflow: 'hidden',
        paddingLeft: spacing[4],
        paddingRight: spacing[4],
        shadowColor: '#101828',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 24
    },
    input: {
        color: colors.text,
        flex: 1,
        fontFamily: fonts.sans,
        fontSize: 15,
        lineHeight: 22,
        minHeight: 36,
        outlineStyle: 'none',
        paddingVertical: 7
    } as object,
    sendButton: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: 14,
        elevation: 18,
        height: 40,
        justifyContent: 'center',
        shadowColor: '#101828',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
        width: 40
    },
    sendButtonDisabled: {
        opacity: 0.55
    },
    sendButtonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.94 }]
    },
    micButton: {
        backgroundColor: colors.brandDark
    },
    micButtonActive: {
        backgroundColor: '#c0392b'
    },
    pressedFeedback: {
        opacity: 0.6
    }
});

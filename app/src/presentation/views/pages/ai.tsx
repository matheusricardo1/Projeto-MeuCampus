import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bot, Brain, Send } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '@/presentation/design-system';

type AIPageProps = {
    bottomInset?: number;
    hidePromptInput?: boolean;
    onChatScroll?: () => void;
};

export function AIPage({ bottomInset = 0, hidePromptInput = false, onChatScroll }: AIPageProps) {
    const scrollRef = useRef<ScrollView | null>(null);
    const scrollToBottom = useCallback((animated = false) => {
        const scheduleFrame = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0);

        scheduleFrame(() => {
            scrollRef.current?.scrollToEnd({ animated });
        });
    }, []);

    useEffect(() => {
        scrollToBottom(false);
        const timeout = setTimeout(() => scrollToBottom(false), 80);
        return () => clearTimeout(timeout);
    }, [scrollToBottom]);

    return (
        <View style={styles.screen}>
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 96 }]}
                onContentSizeChange={() => scrollToBottom(false)}
                onLayout={() => scrollToBottom(false)}
                onScroll={onChatScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                style={styles.chatScroll}
            >
                <View style={styles.chatSection}>
                    <View style={styles.messageRow}>
                        <View style={styles.botAvatar}>
                            <Bot color={colors.inverseText} size={18} />
                        </View>
                        <View style={styles.messageBody}>
                            <View style={styles.botBubble}>
                                <Text style={styles.messageText}>
                                    Ola! Revisei seu semestre e encontrei um ponto de atencao: ha um trabalho de
                                    <Text style={styles.messageTextStrong}> Calculo II </Text>
                                    com entrega em 3 dias. Posso resumir suas notas ou montar um plano rapido de estudo.
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.messageRowUser}>
                        <View style={styles.messageBodyUser}>
                            <View style={styles.userBubble}>
                                <Text style={styles.userMessageText}>Como estao minhas notas em Calculo I?</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.messageRow}>
                        <View style={styles.botAvatar}>
                            <Bot color={colors.inverseText} size={18} />
                        </View>
                        <View style={styles.messageBody}>
                            <View style={styles.botBubble}>
                                <Text style={styles.messageText}>
                                    Seu desempenho em <Text style={styles.messageTextStrong}>Calculo Diferencial e Integral I</Text> esta acima da media da turma.
                                </Text>

                                <View style={styles.summaryCard}>
                                    <View style={styles.summaryHeader}>
                                        <Text style={styles.summaryLabel}>Media atual</Text>
                                        <Text style={styles.summaryValue}>8.5</Text>
                                    </View>
                                    <Text style={styles.summaryHint}>Acima da media da turma: 7.2</Text>
                                </View>

                                <View style={styles.breakdownList}>
                                    <View style={styles.breakdownRow}>
                                        <Text style={styles.breakdownKey}>P1</Text>
                                        <Text style={styles.breakdownValue}>8.2</Text>
                                    </View>
                                    <View style={styles.breakdownRow}>
                                        <Text style={styles.breakdownKey}>P2</Text>
                                        <Text style={styles.breakdownValue}>8.8</Text>
                                    </View>
                                    <View style={styles.breakdownRow}>
                                        <Text style={styles.breakdownKey}>Exercicios</Text>
                                        <Text style={styles.breakdownValue}>9.0</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

            </ScrollView>

            <View pointerEvents={hidePromptInput ? 'none' : 'auto'} style={[styles.inputDock, hidePromptInput ? styles.inputDockHidden : null, { bottom: bottomInset }]}>
                <View style={styles.inputBar}>
                    <View style={styles.inputShell}>
                        <Brain color={colors.brand} size={18} />
                        <TextInput
                            style={styles.input}
                            placeholder="Pergunte qualquer coisa..."
                            placeholderTextColor={colors.textSubtle}
                        />
                    </View>
                    <Pressable style={styles.sendButton}>
                        <Send color={colors.inverseText} size={18} />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.canvas,
        flex: 1
    },
    content: {
        flexGrow: 1,
        gap: spacing[4],
        paddingTop: spacing[4]
    },
    chatScroll: {
        flex: 1,
        minHeight: 0
    },
    chatSection: {
        gap: spacing[4],
        paddingHorizontal: spacing[3]
    },
    messageRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: spacing[3]
    },
    messageRowUser: {
        alignItems: 'flex-end'
    },
    botAvatar: {
        alignItems: 'center',
        backgroundColor: colors.brandDark,
        borderRadius: radii.pill,
        height: 40,
        justifyContent: 'center',
        width: 40
    },
    messageBody: {
        flex: 1,
        gap: spacing[2],
        minWidth: 0
    },
    messageBodyUser: {
        alignItems: 'flex-end',
        gap: spacing[2],
        maxWidth: '84%'
    },
    botBubble: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 20,
        borderTopLeftRadius: 8,
        borderWidth: 1,
        gap: spacing[3],
        padding: spacing[4]
    },
    userBubble: {
        backgroundColor: colors.brandDark,
        borderRadius: 20,
        borderTopRightRadius: 8,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3]
    },
    messageText: {
        color: colors.text,
        fontFamily: fonts.sans,
        fontSize: 15,
        lineHeight: 22
    },
    messageTextStrong: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontWeight: '800'
    },
    userMessageText: {
        color: colors.inverseText,
        fontFamily: fonts.sans,
        fontSize: 15,
        lineHeight: 22
    },
    summaryCard: {
        backgroundColor: colors.brandSubtle,
        borderRadius: 14,
        gap: spacing[1],
        padding: spacing[3]
    },
    summaryHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    summaryLabel: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    summaryValue: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 22,
        fontWeight: '800'
    },
    summaryHint: {
        color: colors.brand,
        fontFamily: fonts.sans,
        fontSize: 14,
        lineHeight: 20
    },
    breakdownList: {
        borderTopColor: colors.border,
        borderTopWidth: 1,
        gap: spacing[2],
        paddingTop: spacing[3]
    },
    breakdownRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    breakdownKey: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    breakdownValue: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '800'
    },
    inputDock: {
        alignItems: 'center',
        elevation: 20,
        left: 0,
        paddingHorizontal: spacing[4],
        paddingBottom: spacing[4],
        paddingTop: spacing[3],
        position: 'absolute',
        right: 0,
        zIndex: 20
    },
    inputDockHidden: {
        opacity: 0
    },
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
        minHeight: 36,
        paddingVertical: 0
    },
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
    }
});

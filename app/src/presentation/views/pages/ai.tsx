import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { Bot, Brain, Send } from 'lucide-react-native';
import type { AiChatMessage } from '@/domain/entities/ai-chat-message';
import type { AiChatReply } from '@/domain/entities/ai-chat-reply';
import { colors, fonts, radii, spacing } from '@/presentation/design-system';

type AIPageProps = {
    bottomInset?: number;
    hidePromptInput?: boolean;
    onChatScroll?: () => void;
    onSendMessage?: (input: { conversationId?: string; message: string; history?: AiChatMessage[] }) => Promise<AiChatReply | null>;
};

type ChatMessage = AiChatMessage & {
    kind?: 'text' | 'grade-summary';
};

const initialMessages: ChatMessage[] = [
    {
        id: 'welcome',
        role: 'assistant',
        content: 'Ola! Como posso ajudar com sua vida academica hoje?',
        createdAt: new Date(0).toISOString()
    }
];

export function AIPage({ bottomInset = 0, hidePromptInput = false, onChatScroll, onSendMessage }: AIPageProps) {
    const scrollRef = useRef<ScrollView | null>(null);
    const lastSentPromptRef = useRef<{ prompt: string; sentAt: number } | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [prompt, setPrompt] = useState('');
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [isSending, setIsSending] = useState(false);
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

    const sendPrompt = useCallback(async () => {
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt || isSending) return;

        const now = Date.now();
        const lastSentPrompt = lastSentPromptRef.current;
        if (lastSentPrompt?.prompt === trimmedPrompt && now - lastSentPrompt.sentAt < 350) {
            return;
        }

        lastSentPromptRef.current = { prompt: trimmedPrompt, sentAt: now };

        const userMessage: ChatMessage = {
            id: `user-${now}`,
            role: 'user',
            content: trimmedPrompt,
            createdAt: new Date().toISOString()
        };

        const history = messages.map(({ kind: _kind, ...message }) => message);
        setMessages((current) => [...current, userMessage]);
        setPrompt('');
        setIsSending(true);
        scrollToBottom(true);

        try {
            const reply = await onSendMessage?.({
                ...(conversationId ? { conversationId } : {}),
                message: trimmedPrompt,
                history
            });

            if (!reply) {
                throw new Error('A IA nao respondeu agora. Tente novamente.');
            }

            setConversationId(reply.conversationId);
            setMessages((current) => [...current, reply.message]);
            scrollToBottom(true);
        } catch (error) {
            setMessages((current) => current.filter((message) => message.id !== userMessage.id));
            setPrompt(trimmedPrompt);
        } finally {
            setIsSending(false);
        }
    }, [conversationId, isSending, messages, onSendMessage, prompt, scrollToBottom]);

    const handleInputKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        if (event.nativeEvent.key === 'Enter') {
            sendPrompt();
        }
    };

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
                    {messages.map((message) => (
                        message.role === 'user' ? (
                            <View key={message.id} style={styles.messageRowUser}>
                                <View style={styles.messageBodyUser}>
                                    <View style={styles.userBubble}>
                                        <Text style={styles.userMessageText}>{message.content}</Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View key={message.id} style={styles.messageRow}>
                                <View style={styles.botAvatar}>
                                    <Bot color={colors.inverseText} size={18} />
                                </View>
                                <View style={styles.messageBody}>
                                    <View style={styles.botBubble}>
                                        <Text style={styles.messageText}>{message.content}</Text>

                                        {message.kind === 'grade-summary' ? (
                                            <>
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
                                            </>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                        )
                    ))}
                </View>

            </ScrollView>

            <View pointerEvents={hidePromptInput ? 'none' : 'auto'} style={[styles.inputDock, hidePromptInput ? styles.inputDockHidden : null, { bottom: bottomInset }]}>
                <View style={styles.inputBar}>
                    <View style={styles.inputShell}>
                        <Brain color={colors.brand} size={18} />
                        <TextInput
                            style={styles.input}
                            blurOnSubmit={false}
                            editable={!isSending}
                            onChangeText={setPrompt}
                            onKeyPress={handleInputKeyPress}
                            onSubmitEditing={sendPrompt}
                            placeholder="Pergunte qualquer coisa..."
                            placeholderTextColor={colors.textSubtle}
                            returnKeyType="send"
                            value={prompt}
                        />
                    </View>
                    <Pressable disabled={isSending} onPress={sendPrompt} style={[styles.sendButton, isSending ? styles.sendButtonDisabled : null]}>
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
        alignSelf: 'center',
        gap: spacing[4],
        maxWidth: 760,
        paddingHorizontal: spacing[3],
        width: '100%'
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
        outlineStyle: 'none',
        paddingVertical: 0
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
    }
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { Bot, Brain, Send } from 'lucide-react-native';
import type { AiChatMessage } from '@/modules/academic/domain/entities/ai-chat-message';
import type { AiChatReply } from '@/modules/academic/domain/entities/ai-chat-reply';
import { colors, fonts, radii, spacing } from '@/shared/design-system';

type AIPageProps = {
    bottomInset?: number;
    hidePromptInput?: boolean;
    onChatScroll?: () => void;
    onSendMessage?: (input: { conversationId?: string; message: string; history?: AiChatMessage[] }) => Promise<AiChatReply | null>;
};

type ChatMessage = AiChatMessage & {
    kind?: 'text' | 'grade-summary' | 'processing';
    fullContent?: string;
    isTyping?: boolean;
};

const initialMessages: ChatMessage[] = [
    {
        id: 'welcome',
        role: 'assistant',
        content: 'Ola! Como posso ajudar com sua vida academica hoje?',
        createdAt: new Date(0).toISOString()
    }
];

const AI_TYPING_FRAME_MS = 30;

export function AIPage({ bottomInset = 0, hidePromptInput = false, onChatScroll, onSendMessage }: AIPageProps) {
    const scrollRef = useRef<ScrollView | null>(null);
    const lastSentPromptRef = useRef<{ prompt: string; sentAt: number } | null>(null);
    const processingPulse = useRef(new Animated.Value(0)).current;
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

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(processingPulse, {
                    toValue: 1,
                    duration: 850,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true
                }),
                Animated.timing(processingPulse, {
                    toValue: 0,
                    duration: 850,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true
                })
            ])
        );

        animation.start();
        return () => animation.stop();
    }, [processingPulse]);

    useEffect(() => {
        const typingMessage = messages.find((message) => message.role === 'assistant' && message.isTyping && message.fullContent);
        if (!typingMessage?.fullContent) {
            return undefined;
        }

        if (typingMessage.content.length >= typingMessage.fullContent.length) {
            setMessages((current) => current.map((message) => (
                message.id === typingMessage.id
                    ? { ...message, content: typingMessage.fullContent || message.content, isTyping: false, fullContent: undefined }
                    : message
            )));
            return undefined;
        }

        const nextLength = Math.min(
            typingMessage.fullContent.length,
            typingMessage.content.length + Math.max(2, Math.ceil(typingMessage.fullContent.length / 90))
        );
        const timeout = setTimeout(() => {
            setMessages((current) => current.map((message) => (
                message.id === typingMessage.id && message.fullContent
                    ? { ...message, content: message.fullContent.slice(0, nextLength) }
                    : message
            )));
            scrollToBottom(false);
        }, AI_TYPING_FRAME_MS);

        return () => clearTimeout(timeout);
    }, [messages, scrollToBottom]);

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
        const processingMessage: ChatMessage = {
            id: `assistant-processing-${now}`,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            kind: 'processing'
        };

        const history = messages.map(({ kind: _kind, ...message }) => message);
        setMessages((current) => [...current, userMessage, processingMessage]);
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
            setMessages((current) => current.map((message) => (
                message.id === processingMessage.id
                    ? {
                        ...reply.message,
                        content: '',
                        fullContent: reply.message.content,
                        isTyping: true
                    }
                    : message
            )));
            scrollToBottom(true);
        } catch (error) {
            setMessages((current) => current.filter((message) => message.id !== userMessage.id && message.id !== processingMessage.id));
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
                                        {message.kind === 'processing' ? (
                                            <ProcessingMessage pulse={processingPulse} />
                                        ) : (
                                            <>
                                                <FormattedAssistantMessage content={message.content} isTyping={message.isTyping} />
                                            </>
                                        )}

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

function ProcessingMessage({ pulse }: { pulse: Animated.Value }) {
    const opacity = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.42, 1]
    });

    return (
        <View style={styles.processingStack}>
            <View style={styles.processingHeader}>
                <Animated.View style={[styles.processingDot, { opacity }]} />
                <Text style={styles.processingText}>Processando sua mensagem</Text>
            </View>
            <Animated.View style={[styles.processingLineWide, { opacity }]} />
            <Animated.View style={[styles.processingLine, { opacity }]} />
            <Animated.View style={[styles.processingLineShort, { opacity }]} />
        </View>
    );
}

function FormattedAssistantMessage({ content, isTyping = false }: { content: string; isTyping?: boolean }) {
    const blocks = useMemo(() => parseFormattedBlocks(content), [content]);

    return (
        <View style={styles.formattedStack}>
            {blocks.map((block, index) => {
                const isLastBlock = index === blocks.length - 1;

                if (block.type === 'list') {
                    return (
                        <View key={`list-${index}`} style={styles.formattedList}>
                            {block.items.map((item, itemIndex) => (
                                <View key={`${item}-${itemIndex}`} style={styles.formattedListRow}>
                                    <Text style={styles.formattedBullet}>•</Text>
                                    <FormattedInlineText content={item} style={styles.messageText} showCursor={isTyping && isLastBlock && itemIndex === block.items.length - 1} />
                                </View>
                            ))}
                        </View>
                    );
                }

                if (block.type === 'heading') {
                    return <FormattedInlineText key={`heading-${index}`} content={block.content} style={styles.formattedHeading} showCursor={isTyping && isLastBlock} />;
                }

                return <FormattedInlineText key={`paragraph-${index}`} content={block.content} style={styles.messageText} showCursor={isTyping && isLastBlock} />;
            })}
        </View>
    );
}

function FormattedInlineText({ content, style, showCursor = false }: { content: string; style: object; showCursor?: boolean }) {
    const segments = useMemo(() => parseInlineSegments(content), [content]);

    return (
        <Text style={style}>
            {segments.map((segment, index) => (
                <Text key={`${segment.text}-${index}`} style={segment.strong ? styles.messageTextStrong : undefined}>
                    {segment.text}
                </Text>
            ))}
            {showCursor ? <Text style={styles.typingCursor}>▌</Text> : null}
        </Text>
    );
}

type FormattedBlock =
    | { type: 'heading'; content: string }
    | { type: 'paragraph'; content: string }
    | { type: 'list'; items: string[] };

function parseFormattedBlocks(content: string): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    let paragraph: string[] = [];
    let listItems: string[] = [];

    const flushParagraph = () => {
        if (paragraph.length > 0) {
            blocks.push({ type: 'paragraph', content: paragraph.join(' ').trim() });
            paragraph = [];
        }
    };
    const flushList = () => {
        if (listItems.length > 0) {
            blocks.push({ type: 'list', items: listItems });
            listItems = [];
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            flushParagraph();
            flushList();
            continue;
        }

        const heading = line.match(/^#{1,3}\s+(.+)$/);
        if (heading?.[1]) {
            flushParagraph();
            flushList();
            blocks.push({ type: 'heading', content: heading[1].trim() });
            continue;
        }

        const listItem = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
        if (listItem?.[1]) {
            flushParagraph();
            listItems.push(listItem[1].trim());
            continue;
        }

        flushList();
        paragraph.push(line);
    }

    flushParagraph();
    flushList();
    return blocks.length ? blocks : [{ type: 'paragraph', content }];
}

function parseInlineSegments(content: string): Array<{ text: string; strong: boolean }> {
    const segments: Array<{ text: string; strong: boolean }> = [];
    const pattern = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ text: content.slice(lastIndex, match.index), strong: false });
        }

        segments.push({ text: match[1] || '', strong: true });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
        segments.push({ text: content.slice(lastIndex), strong: false });
    }

    return segments.length ? segments : [{ text: content, strong: false }];
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
    formattedStack: {
        gap: spacing[2]
    },
    formattedHeading: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 16,
        fontWeight: '800',
        lineHeight: 22
    },
    formattedList: {
        gap: spacing[2]
    },
    formattedListRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: spacing[2]
    },
    formattedBullet: {
        color: colors.brand,
        fontFamily: fonts.medium,
        fontSize: 16,
        fontWeight: '800',
        lineHeight: 22,
        width: 14
    },
    messageTextStrong: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontWeight: '800'
    },
    typingCursor: {
        alignSelf: 'baseline',
        color: colors.brand,
        fontFamily: fonts.medium,
        fontSize: 16,
        fontWeight: '800',
        lineHeight: 22
    },
    processingStack: {
        gap: spacing[2],
        minHeight: 86
    },
    processingHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[1]
    },
    processingDot: {
        backgroundColor: colors.brand,
        borderRadius: radii.pill,
        height: 8,
        width: 8
    },
    processingText: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18
    },
    processingLineWide: {
        backgroundColor: colors.border,
        borderRadius: radii.pill,
        height: 12,
        width: '92%'
    },
    processingLine: {
        backgroundColor: colors.border,
        borderRadius: radii.pill,
        height: 12,
        width: '74%'
    },
    processingLineShort: {
        backgroundColor: colors.border,
        borderRadius: radii.pill,
        height: 12,
        width: '46%'
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

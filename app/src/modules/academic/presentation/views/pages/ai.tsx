import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { Bot, Brain, Check, Pencil, RotateCcw, Send, Square, X } from 'lucide-react-native';
import type { AiChatMessage } from '@/modules/academic/domain/entities/ai-chat-message';
import type { AiChatReply } from '@/modules/academic/domain/entities/ai-chat-reply';
import { colors, fonts, radii, spacing } from '@/shared/design-system';

type SendMessageHandlers = {
    onJobId?: (jobId: string) => void;
    onChunk?: (delta: string) => void;
};

type AIPageProps = {
    bottomInset?: number;
    hidePromptInput?: boolean;
    onCancelMessage?: (jobId: string) => Promise<void>;
    onChatScroll?: () => void;
    onSendMessage?: (input: { conversationId?: string; message: string; history?: AiChatMessage[] }, handlers?: SendMessageHandlers) => Promise<AiChatReply | null>;
};

type ChatMessage = AiChatMessage & {
    kind?: 'text' | 'grade-summary' | 'processing';
};

const initialMessages: ChatMessage[] = [
    {
        id: 'welcome',
        role: 'assistant',
        content: 'Ola! Como posso ajudar com sua vida academica hoje?',
        createdAt: new Date(0).toISOString()
    }
];

export function AIPage({ bottomInset = 0, hidePromptInput = false, onCancelMessage, onChatScroll, onSendMessage }: AIPageProps) {
    const scrollRef = useRef<ScrollView | null>(null);
    const lastSentPromptRef = useRef<{ prompt: string; sentAt: number } | null>(null);
    const processingPulse = useRef(new Animated.Value(0)).current;
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [prompt, setPrompt] = useState('');
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [isSending, setIsSending] = useState(false);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
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

    const runExchange = useCallback(async (promptText: string, historyBase: ChatMessage[]) => {
        const trimmedPrompt = promptText.trim();
        if (!trimmedPrompt || isSending) return;

        const now = Date.now();
        const userMessage: ChatMessage = {
            id: `user-${now}`,
            role: 'user',
            content: trimmedPrompt,
            createdAt: new Date().toISOString()
        };
        const assistantId = `assistant-${now}`;
        const processingMessage: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            kind: 'processing'
        };

        const history = historyBase.map(({ kind: _kind, ...message }) => message);
        setMessages([...historyBase, userMessage, processingMessage]);
        setIsSending(true);
        setStreamingMessageId(assistantId);
        setActiveJobId(null);
        scrollToBottom(true);

        let hasStreamedContent = false;

        try {
            const reply = await onSendMessage?.(
                {
                    ...(conversationId ? { conversationId } : {}),
                    message: trimmedPrompt,
                    history
                },
                {
                    onJobId: (jobId) => setActiveJobId(jobId),
                    onChunk: (delta) => {
                        hasStreamedContent = true;
                        setMessages((current) => current.map((message) => (
                            message.id === assistantId
                                ? { ...message, kind: 'text', content: message.content + delta }
                                : message
                        )));
                        scrollToBottom(false);
                    }
                }
            );

            if (!reply) {
                throw new Error('A IA nao respondeu agora. Tente novamente.');
            }

            setConversationId(reply.conversationId);
            setMessages((current) => current.map((message) => (
                message.id === assistantId
                    ? { ...reply.message, id: assistantId, kind: 'text' }
                    : message
            )));
            scrollToBottom(true);
        } catch (error) {
            if (hasStreamedContent) {
                setMessages((current) => current.map((message) => (
                    message.id === assistantId ? { ...message, kind: 'text' } : message
                )));
            } else {
                setMessages(historyBase);
                setPrompt(trimmedPrompt);
            }
        } finally {
            setIsSending(false);
            setActiveJobId(null);
            setStreamingMessageId(null);
        }
    }, [conversationId, isSending, onSendMessage, scrollToBottom]);

    const sendPrompt = useCallback(() => {
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt || isSending) return;

        const now = Date.now();
        const lastSentPrompt = lastSentPromptRef.current;
        if (lastSentPrompt?.prompt === trimmedPrompt && now - lastSentPrompt.sentAt < 350) {
            return;
        }

        lastSentPromptRef.current = { prompt: trimmedPrompt, sentAt: now };
        setPrompt('');
        void runExchange(trimmedPrompt, messages);
    }, [isSending, messages, prompt, runExchange]);

    const regenerateLast = useCallback(() => {
        if (isSending) return;

        let userIndex = -1;
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            if (messages[index]?.role === 'user') {
                userIndex = index;
                break;
            }
        }
        if (userIndex === -1) return;

        const promptText = messages[userIndex]?.content ?? '';
        void runExchange(promptText, messages.slice(0, userIndex));
    }, [isSending, messages, runExchange]);

    const startEditing = useCallback((message: ChatMessage) => {
        if (isSending) return;
        setEditingMessageId(message.id);
        setEditingText(message.content);
    }, [isSending]);

    const cancelEditing = useCallback(() => {
        setEditingMessageId(null);
        setEditingText('');
    }, []);

    const submitEdit = useCallback(() => {
        if (!editingMessageId) return;

        const index = messages.findIndex((message) => message.id === editingMessageId);
        const promptText = editingText.trim();
        setEditingMessageId(null);
        setEditingText('');

        if (index === -1 || !promptText) return;
        void runExchange(promptText, messages.slice(0, index));
    }, [editingMessageId, editingText, messages, runExchange]);

    const stopGenerating = useCallback(() => {
        if (!activeJobId) return;
        void onCancelMessage?.(activeJobId);
    }, [activeJobId, onCancelMessage]);

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
                    {messages.map((message, index) => (
                        message.role === 'user' ? (
                            <View key={message.id} style={styles.messageRowUser}>
                                <View style={styles.messageBodyUser}>
                                    {editingMessageId === message.id ? (
                                        <View style={styles.editBubble}>
                                            <TextInput
                                                autoFocus
                                                multiline
                                                onChangeText={setEditingText}
                                                style={styles.editInput}
                                                value={editingText}
                                            />
                                            <View style={styles.editActions}>
                                                <Pressable onPress={cancelEditing} style={styles.editActionButton}>
                                                    <X color={colors.textMuted} size={16} />
                                                </Pressable>
                                                <Pressable disabled={!editingText.trim()} onPress={submitEdit} style={[styles.editActionButton, styles.editActionButtonPrimary]}>
                                                    <Check color={colors.inverseText} size={16} />
                                                </Pressable>
                                            </View>
                                        </View>
                                    ) : (
                                        <>
                                            <View style={styles.userBubble}>
                                                <Text style={styles.userMessageText}>{message.content}</Text>
                                            </View>
                                            <Pressable disabled={isSending} onPress={() => startEditing(message)} style={styles.messageActionButton}>
                                                <Pencil color={colors.textSubtle} size={13} />
                                                <Text style={styles.messageActionText}>Editar</Text>
                                            </Pressable>
                                        </>
                                    )}
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
                                                <FormattedAssistantMessage content={message.content} isTyping={message.id === streamingMessageId} />
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

                                    {!isSending && message.kind === 'text' && index === messages.length - 1 ? (
                                        <Pressable onPress={regenerateLast} style={styles.messageActionButton}>
                                            <RotateCcw color={colors.textSubtle} size={13} />
                                            <Text style={styles.messageActionText}>Refazer resposta</Text>
                                        </Pressable>
                                    ) : null}
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
                    {isSending ? (
                        <Pressable onPress={stopGenerating} style={[styles.sendButton, styles.stopButton]}>
                            <Square color={colors.inverseText} fill={colors.inverseText} size={14} />
                        </Pressable>
                    ) : (
                        <Pressable disabled={!prompt.trim()} onPress={sendPrompt} style={[styles.sendButton, !prompt.trim() ? styles.sendButtonDisabled : null]}>
                            <Send color={colors.inverseText} size={18} />
                        </Pressable>
                    )}
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
    messageActionButton: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[1],
        paddingHorizontal: spacing[1],
        paddingVertical: 2
    },
    messageActionText: {
        color: colors.textSubtle,
        fontFamily: fonts.medium,
        fontSize: 11.5,
        fontWeight: '700'
    },
    editBubble: {
        backgroundColor: colors.surface,
        borderColor: colors.brand,
        borderRadius: 16,
        borderWidth: 1.5,
        gap: spacing[2],
        maxWidth: '100%',
        padding: spacing[3],
        width: '100%'
    },
    editInput: {
        color: colors.text,
        fontFamily: fonts.sans,
        fontSize: 15,
        lineHeight: 22,
        minHeight: 40,
        outlineStyle: 'none',
        textAlignVertical: 'top'
    } as object,
    editActions: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'flex-end'
    },
    editActionButton: {
        alignItems: 'center',
        backgroundColor: colors.canvas,
        borderRadius: radii.pill,
        height: 30,
        justifyContent: 'center',
        width: 30
    },
    editActionButtonPrimary: {
        backgroundColor: colors.brand
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
    },
    stopButton: {
        backgroundColor: colors.textMuted
    }
});

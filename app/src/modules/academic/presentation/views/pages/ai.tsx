import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Linking, Modal, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { AlertCircle, AlertTriangle, Bot, Brain, Check, ExternalLink, Lock, Mic, Pencil, RotateCcw, Send, Sparkles, Square, X } from 'lucide-react-native';
import type { AiChatMessage } from '@/modules/academic/domain/entities/ai-chat-message';
import type { AiChatReply } from '@/modules/academic/domain/entities/ai-chat-reply';
import { AiDailyLimitReachedError } from '@/shared/errors/ai-daily-limit-reached.error';
import { colors, fonts, radii, spacing } from '@/shared/design-system';
import { MercadoPagoCardBrick } from '@/modules/academic/presentation/views/components/mercadopago-card-brick';
import type { CardBrickTokenResult } from '@/modules/academic/presentation/views/components/mercadopago-card-brick.types';
import type { CreateCardCheckoutRequest } from '@/modules/academic/domain/repositories/ecampus-repository';
import { useSpeechToText, type SpeechToTextErrorReason } from '@/modules/academic/presentation/hooks/use-speech-to-text';
import { hapticConfirm, hapticTap } from '@/shared/haptics';
import { aiInputBarStyles } from '@/modules/academic/presentation/views/pages/ai-input-bar.styles';

type SendMessageHandlers = {
    onJobId?: (jobId: string) => void;
    onToolCall?: (toolName: string) => void;
};

type PixCheckout = { paymentId: string; qrCode: string; qrCodeBase64: string; expiresAt: string };
type CheckoutStatus = { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' };
type CardCheckoutResult = { paymentId: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'; statusDetail: string };

type AIPageProps = {
    bottomInset?: number;
    hidePromptInput?: boolean;
    onCancelMessage?: (jobId: string) => Promise<void>;
    onChatScroll?: () => void;
    onCreateCardCheckout?: (input: CreateCardCheckoutRequest) => Promise<CardCheckoutResult>;
    onCreatePixCheckout?: () => Promise<PixCheckout>;
    onGetCheckoutStatus?: (paymentId: string) => Promise<CheckoutStatus>;
    onGetMercadoPagoPublicKey?: () => Promise<{ publicKey: string; amount: number }>;
    onPersistState?: (state: { conversationId?: string; messages: AiChatMessage[] }) => void;
    onSendMessage?: (input: { conversationId?: string; message: string; history?: AiChatMessage[] }, handlers?: SendMessageHandlers) => Promise<AiChatReply | null>;
    persistedConversationId?: string;
    persistedMessages?: AiChatMessage[];
};

type ChatMessage = AiChatMessage & {
    kind?: 'text' | 'processing' | 'error';
    statusLabel?: string;
};

const TOOL_STATUS_LABELS: Record<string, string> = {
    get_student_profile: 'Consultando seu perfil...',
    get_current_grades: 'Buscando suas notas...',
    get_schedule: 'Consultando seu horario...',
    get_lesson_plan_subjects: 'Listando suas disciplinas...',
    get_lesson_plan: 'Buscando o plano de ensino...'
};

function toolStatusLabel(toolName: string): string {
    return TOOL_STATUS_LABELS[toolName] || 'Buscando seus dados academicos...';
}

const INPUT_LINE_HEIGHT = 22;
const INPUT_MAX_LINES = 4;
const INPUT_MIN_HEIGHT = 36;
const INPUT_MAX_HEIGHT = INPUT_LINE_HEIGHT * INPUT_MAX_LINES;

const initialMessages: ChatMessage[] = [
    {
        id: 'welcome',
        role: 'assistant',
        content: 'Ola! Como posso ajudar com sua vida academica hoje?',
        createdAt: new Date(0).toISOString()
    }
];

function voiceErrorMessage(reason: SpeechToTextErrorReason): string {
    switch (reason) {
        case 'permission-denied':
            return 'Permita o acesso ao microfone para usar o ditado por voz.';
        case 'no-speech':
            return 'Nao entendi, tente falar novamente.';
        case 'network':
            return 'Sem conexao para reconhecer sua voz agora.';
        case 'not-supported':
            return 'Ditado por voz nao esta disponivel neste navegador.';
        default:
            return 'Nao foi possivel captar sua voz. Tente novamente.';
    }
}

export function AIPage({ bottomInset = 0, hidePromptInput = false, onCancelMessage, onChatScroll, onCreateCardCheckout, onCreatePixCheckout, onGetCheckoutStatus, onGetMercadoPagoPublicKey, onPersistState, onSendMessage, persistedConversationId, persistedMessages }: AIPageProps) {
    const scrollRef = useRef<ScrollView | null>(null);
    const inputRef = useRef<TextInput | null>(null);
    const lastSentPromptRef = useRef<{ prompt: string; sentAt: number } | null>(null);
    const processingPulse = useRef(new Animated.Value(0)).current;
    const [messages, setMessages] = useState<ChatMessage[]>(() => (
        persistedMessages && persistedMessages.length > 0
            ? persistedMessages.map((message): ChatMessage => ({ ...message, kind: 'text' }))
            : initialMessages
    ));
    const [prompt, setPrompt] = useState('');
    const [conversationId, setConversationId] = useState<string | undefined>(persistedConversationId);
    const [isSending, setIsSending] = useState(false);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [revealedLength, setRevealedLength] = useState(0);
    const [revealTarget, setRevealTarget] = useState<{ id: string; length: number } | null>(null);
    const [dailyLimit, setDailyLimit] = useState<{ limit: number } | null>(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const micPulse = useRef(new Animated.Value(0)).current;
    const waveformBars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.3))).current;
    const [showVoiceError, setShowVoiceError] = useState(false);
    const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);

    const handleVoiceTranscript = useCallback((transcript: string) => {
        const trimmedTranscript = transcript.trim();
        if (!trimmedTranscript) return;

        setPrompt((current) => {
            const trimmedCurrent = current.trim();
            return trimmedCurrent ? `${trimmedCurrent} ${trimmedTranscript}` : trimmedTranscript;
        });
    }, []);

    const speech = useSpeechToText({ lang: 'pt-BR', onFinalTranscript: handleVoiceTranscript });

    useEffect(() => {
        if (!speech.errorReason) return undefined;

        setShowVoiceError(true);
        const timeout = setTimeout(() => setShowVoiceError(false), 4000);
        return () => clearTimeout(timeout);
    }, [speech.errorReason]);

    useEffect(() => {
        if (!speech.isListening) {
            micPulse.stopAnimation();
            micPulse.setValue(0);
            return undefined;
        }

        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(micPulse, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(micPulse, { toValue: 0, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
            ])
        );

        animation.start();
        return () => animation.stop();
    }, [micPulse, speech.isListening]);

    useEffect(() => {
        if (!speech.isListening) {
            waveformBars.forEach((bar) => {
                bar.stopAnimation();
                bar.setValue(0.3);
            });
            return undefined;
        }

        // Each bar bounces at a slightly different duration and start delay so the
        // row reads as an organic voice waveform rather than bars moving in lockstep.
        const animations = waveformBars.map((bar, index) => Animated.loop(
            Animated.sequence([
                Animated.timing(bar, { toValue: 1, duration: 380 + index * 65, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(bar, { toValue: 0.25, duration: 380 + index * 65, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
            ])
        ));
        const timeouts = animations.map((animation, index) => setTimeout(() => animation.start(), index * 60));

        return () => {
            timeouts.forEach(clearTimeout);
            animations.forEach((animation) => animation.stop());
        };
    }, [speech.isListening, waveformBars]);

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
        const persistableMessages = messages
            .filter((message) => message.kind !== 'processing')
            .map(({ kind: _kind, statusLabel: _statusLabel, ...message }) => message);
        onPersistState?.({ conversationId, messages: persistableMessages });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, conversationId]);

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

    // The backend no longer streams tokens over the network — it sends the
    // complete, already-structured reply in one shot. This simulates the
    // "typing" feel client-side by revealing a few characters at a time.
    useEffect(() => {
        if (!revealTarget) return undefined;

        const timer = setInterval(() => {
            setRevealedLength((current) => {
                const next = Math.min(current + 3, revealTarget.length);
                if (next >= revealTarget.length) {
                    clearInterval(timer);
                    setStreamingMessageId(null);
                    setRevealTarget(null);
                }
                return next;
            });
            scrollToBottom(false);
        }, 16);

        return () => clearInterval(timer);
    }, [revealTarget, scrollToBottom]);

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== '/') return;

            const active = document.activeElement;
            const isTypingElsewhere = active instanceof HTMLElement
                && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
            if (isTypingElsewhere) return;

            event.preventDefault();
            inputRef.current?.focus();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

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

        const history = historyBase.map(({ kind: _kind, statusLabel: _statusLabel, ...message }) => message);
        setMessages([...historyBase, userMessage, processingMessage]);
        setIsSending(true);
        setStreamingMessageId(assistantId);
        setRevealedLength(0);
        setActiveJobId(null);
        scrollToBottom(true);

        try {
            const reply = await onSendMessage?.(
                {
                    ...(conversationId ? { conversationId } : {}),
                    message: trimmedPrompt,
                    history
                },
                {
                    onJobId: (jobId) => setActiveJobId(jobId),
                    onToolCall: (toolName) => {
                        setMessages((current) => current.map((message) => (
                            message.id === assistantId && message.kind === 'processing'
                                ? { ...message, statusLabel: toolStatusLabel(toolName) }
                                : message
                        )));
                    }
                }
            );

            if (!reply) {
                throw new Error('A IA nao respondeu agora. Tente novamente.');
            }

            setConversationId(reply.conversationId);
            setRevealedLength(0);
            setMessages((current) => current.map((message) => (
                message.id === assistantId
                    ? { ...reply.message, id: assistantId, kind: 'text' }
                    : message
            )));
            // streamingMessageId stays set — setting revealTarget arms the
            // reveal effect above, which owns clearing it once the
            // typewriter animation finishes.
            setRevealTarget({ id: assistantId, length: reply.message.content.length });
            scrollToBottom(true);
        } catch (error) {
            setStreamingMessageId(null);

            if (error instanceof AiDailyLimitReachedError) {
                setMessages(historyBase);
                setPrompt(trimmedPrompt);
                setDailyLimit({ limit: error.limit });
            } else {
                const errorText = error instanceof Error ? error.message : 'Nao foi possivel responder agora.';
                setMessages((current) => current.map((message) => (
                    message.id === assistantId ? { ...message, kind: 'error', content: errorText } : message
                )));
            }
        } finally {
            setIsSending(false);
            setActiveJobId(null);
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
        setInputHeight(INPUT_MIN_HEIGHT);
        hapticConfirm();
        void runExchange(trimmedPrompt, messages);
    }, [isSending, messages, prompt, runExchange]);

    const sendQuickReply = useCallback((option: string) => {
        if (isSending) return;
        void runExchange(option, messages);
    }, [isSending, messages, runExchange]);

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
        const nativeEvent = event.nativeEvent as TextInputKeyPressEventData & { preventDefault?: () => void; shiftKey?: boolean };
        if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
            nativeEvent.preventDefault?.();
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
                                                <Pressable onPress={cancelEditing} style={({ pressed }) => [styles.editActionButton, pressed ? styles.pressedFeedback : null]}>
                                                    <X color={colors.textMuted} size={16} />
                                                </Pressable>
                                                <Pressable disabled={!editingText.trim()} onPress={submitEdit} style={({ pressed }) => [styles.editActionButton, styles.editActionButtonPrimary, pressed ? styles.pressedFeedback : null]}>
                                                    <Check color={colors.inverseText} size={16} />
                                                </Pressable>
                                            </View>
                                        </View>
                                    ) : (
                                        <>
                                            <View style={styles.userBubble}>
                                                <Text style={styles.userMessageText}>{message.content}</Text>
                                            </View>
                                            <Pressable disabled={isSending} onPress={() => startEditing(message)} style={({ pressed }) => [styles.messageActionButton, pressed ? styles.pressedFeedback : null]}>
                                                <Pencil color={colors.textSubtle} size={13} />
                                                <Text style={styles.messageActionText}>Editar</Text>
                                            </Pressable>
                                        </>
                                    )}
                                </View>
                            </View>
                        ) : (() => {
                            const isTextMessage = message.kind === 'text';
                            const isLastMessage = index === messages.length - 1;
                            const isRevealing = message.id === streamingMessageId;
                            const displayContent = isTextMessage && isRevealing ? message.content.slice(0, revealedLength) : message.content;
                            // Widgets land once the typewriter finishes revealing the
                            // text above them — showing buttons mid-"typing" felt off.
                            const showWidgets = isTextMessage && !isRevealing;

                            return (
                                <View key={message.id} style={styles.messageRow}>
                                    <View style={styles.botAvatar}>
                                        <Bot color={colors.inverseText} size={18} />
                                    </View>
                                    <View style={styles.messageBody}>
                                        <View style={[styles.botBubble, message.kind === 'error' ? styles.botBubbleError : null]}>
                                            {message.kind === 'processing' ? (
                                                <ProcessingMessage pulse={processingPulse} statusLabel={message.statusLabel} />
                                            ) : message.kind === 'error' ? (
                                                <View style={styles.errorMessageRow}>
                                                    <AlertTriangle color="#ba1a1a" size={16} />
                                                    <Text style={styles.errorMessageText}>{message.content}</Text>
                                                </View>
                                            ) : (
                                                <>
                                                    <FormattedAssistantMessage content={displayContent} isTyping={isRevealing} />
                                                    {showWidgets && message.table ? <FormattedTable headers={message.table.headers} rows={message.table.rows} /> : null}
                                                </>
                                            )}
                                        </View>

                                        {showWidgets && message.links?.length ? (
                                            <View style={styles.linkRow}>
                                                {message.links.map((url) => (
                                                    <Pressable key={url} onPress={() => void Linking.openURL(url)} style={({ pressed }) => [styles.linkChip, pressed ? styles.pressedFeedback : null]}>
                                                        <ExternalLink color={colors.brandDark} size={13} />
                                                        <Text numberOfLines={1} style={styles.linkChipText}>{linkLabel(url)}</Text>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        ) : null}

                                        {!isSending && showWidgets && isLastMessage && message.quickReplies?.length ? (
                                            <View style={styles.quickReplyRow}>
                                                {message.quickReplies.map((option) => (
                                                    <Pressable key={option} onPress={() => sendQuickReply(option)} style={({ pressed }) => [styles.quickReplyChip, pressed ? styles.pressedFeedback : null]}>
                                                        <Text style={styles.quickReplyChipText}>{option}</Text>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        ) : null}

                                        {!isSending && showWidgets && isLastMessage && message.suggestions?.length ? (
                                            <View style={styles.followupBlock}>
                                                <View style={styles.followupLabelRow}>
                                                    <Sparkles color={colors.textSubtle} size={12} />
                                                    <Text style={styles.followupLabelText}>Perguntas relacionadas</Text>
                                                </View>
                                                <View style={styles.quickReplyRow}>
                                                    {message.suggestions.map((suggestion) => (
                                                        <Pressable key={suggestion} onPress={() => sendQuickReply(suggestion)} style={({ pressed }) => [styles.followupChip, pressed ? styles.pressedFeedback : null]}>
                                                            <Text style={styles.followupChipText}>{suggestion}</Text>
                                                        </Pressable>
                                                    ))}
                                                </View>
                                            </View>
                                        ) : null}

                                        {!isSending && message.kind === 'error' && isLastMessage ? (
                                            <Pressable onPress={regenerateLast} style={({ pressed }) => [styles.messageActionButton, pressed ? styles.pressedFeedback : null]}>
                                                <RotateCcw color={colors.textSubtle} size={13} />
                                                <Text style={styles.messageActionText}>Tentar novamente</Text>
                                            </Pressable>
                                        ) : null}

                                        {!isSending && showWidgets && isLastMessage && message.id !== 'welcome' ? (
                                            <Pressable onPress={regenerateLast} style={({ pressed }) => [styles.messageActionButton, pressed ? styles.pressedFeedback : null]}>
                                                <RotateCcw color={colors.textSubtle} size={13} />
                                                <Text style={styles.messageActionText}>Refazer resposta</Text>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                </View>
                            );
                        })()
                    ))}
                </View>

            </ScrollView>

            <View pointerEvents={hidePromptInput ? 'none' : 'auto'} style={[styles.inputDock, hidePromptInput ? styles.inputDockHidden : null, { bottom: bottomInset }]}>
                {dailyLimit ? (
                    <View style={styles.limitBanner}>
                        <View style={styles.limitBannerIcon}>
                            <Lock color={colors.brandDark} size={16} />
                        </View>
                        <View style={styles.limitBannerTextGroup}>
                            <Text style={styles.limitBannerTitle}>Limite diario de {dailyLimit.limit} mensagens atingido</Text>
                            <Text style={styles.limitBannerSubtitle}>Assine por R$ 20/mes e tenha 100 mensagens por dia</Text>
                        </View>
                        <Pressable onPress={() => setIsUpgradeModalOpen(true)} style={({ pressed }) => [styles.limitBannerButton, pressed ? styles.pressedFeedback : null]}>
                            <Text style={styles.limitBannerButtonText}>Assinar</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        {showVoiceError && speech.errorReason ? (
                            <View style={styles.voiceErrorBar}>
                                <AlertCircle color={colors.brandDark} size={14} />
                                <Text style={styles.voiceErrorText}>{voiceErrorMessage(speech.errorReason)}</Text>
                            </View>
                        ) : null}
                        <View style={aiInputBarStyles.inputBar}>
                            <View style={[aiInputBarStyles.inputShell, speech.isListening ? styles.inputShellListening : null]}>
                                {speech.isListening ? (
                                    <View style={styles.waveformRow}>
                                        <View style={styles.waveformBars}>
                                            {waveformBars.map((bar, index) => (
                                                <Animated.View key={index} style={[styles.waveformBar, { transform: [{ scaleY: bar }] }]} />
                                            ))}
                                        </View>
                                        <Text numberOfLines={1} style={styles.waveformHint}>
                                            {speech.interimText || 'Ouvindo...'}
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        <Brain color={colors.brand} size={18} />
                                        <TextInput
                                            ref={inputRef}
                                            style={[aiInputBarStyles.input, { height: inputHeight, maxHeight: INPUT_MAX_HEIGHT }]}
                                            blurOnSubmit={false}
                                            editable={!isSending}
                                            multiline
                                            onChangeText={setPrompt}
                                            onContentSizeChange={(event) => {
                                                const nextHeight = Math.min(Math.max(INPUT_MIN_HEIGHT, event.nativeEvent.contentSize.height), INPUT_MAX_HEIGHT);
                                                setInputHeight(nextHeight);
                                            }}
                                            onKeyPress={handleInputKeyPress}
                                            placeholder="Pergunte qualquer coisa... (/ para focar)"
                                            placeholderTextColor={colors.textSubtle}
                                            returnKeyType="send"
                                            scrollEnabled={inputHeight >= INPUT_MAX_HEIGHT}
                                            value={prompt}
                                        />
                                    </>
                                )}
                            </View>
                            {speech.isSupported ? (
                                <Pressable
                                    accessibilityLabel={speech.isListening ? 'Parar gravacao de voz' : 'Falar para digitar'}
                                    disabled={isSending}
                                    onPress={() => { hapticTap(); speech.toggle(); }}
                                    style={({ pressed }) => [aiInputBarStyles.sendButton, aiInputBarStyles.micButton, speech.isListening ? aiInputBarStyles.micButtonActive : null, isSending ? aiInputBarStyles.sendButtonDisabled : null, pressed ? aiInputBarStyles.sendButtonPressed : null]}
                                >
                                    {speech.isListening ? (
                                        <Animated.View style={{ opacity: micPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }}>
                                            <Square color={colors.inverseText} fill={colors.inverseText} size={13} />
                                        </Animated.View>
                                    ) : (
                                        <Mic color={colors.inverseText} size={18} />
                                    )}
                                </Pressable>
                            ) : null}
                            {isSending ? (
                                <Pressable onPress={stopGenerating} style={({ pressed }) => [aiInputBarStyles.sendButton, styles.stopButton, pressed ? aiInputBarStyles.sendButtonPressed : null]}>
                                    <Square color={colors.inverseText} fill={colors.inverseText} size={14} />
                                </Pressable>
                            ) : !speech.isListening ? (
                                <Pressable disabled={!prompt.trim()} onPress={sendPrompt} style={({ pressed }) => [aiInputBarStyles.sendButton, !prompt.trim() ? aiInputBarStyles.sendButtonDisabled : null, pressed ? aiInputBarStyles.sendButtonPressed : null]}>
                                    <Send color={colors.inverseText} size={18} />
                                </Pressable>
                            ) : null}
                        </View>
                    </>
                )}
            </View>

            <UpgradeModal
                onClose={() => setIsUpgradeModalOpen(false)}
                onCreateCardCheckout={onCreateCardCheckout}
                onCreatePixCheckout={onCreatePixCheckout}
                onGetCheckoutStatus={onGetCheckoutStatus}
                onGetMercadoPagoPublicKey={onGetMercadoPagoPublicKey}
                onPaymentApproved={() => {
                    setIsUpgradeModalOpen(false);
                    setDailyLimit(null);
                }}
                visible={isUpgradeModalOpen}
            />
        </View>
    );
}

type PaymentMethodTab = 'pix' | 'card';

function UpgradeModal({ visible, onClose, onCreateCardCheckout, onCreatePixCheckout, onGetCheckoutStatus, onGetMercadoPagoPublicKey, onPaymentApproved }: {
    visible: boolean;
    onClose: () => void;
    onCreateCardCheckout?: (input: CreateCardCheckoutRequest) => Promise<CardCheckoutResult>;
    onCreatePixCheckout?: () => Promise<PixCheckout>;
    onGetCheckoutStatus?: (paymentId: string) => Promise<CheckoutStatus>;
    onGetMercadoPagoPublicKey?: () => Promise<{ publicKey: string; amount: number }>;
    onPaymentApproved: () => void;
}) {
    const [method, setMethod] = useState<PaymentMethodTab>('pix');

    const [checkout, setCheckout] = useState<PixCheckout | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const [mercadoPagoConfig, setMercadoPagoConfig] = useState<{ publicKey: string; amount: number } | null>(null);
    const [publicKeyError, setPublicKeyError] = useState<string | null>(null);
    const [cardPaymentId, setCardPaymentId] = useState<string | null>(null);
    const [cardStatus, setCardStatus] = useState<'idle' | 'submitting' | 'pending' | 'rejected'>('idle');
    const [cardError, setCardError] = useState<string | null>(null);
    const [brickKey, setBrickKey] = useState(0);

    useEffect(() => {
        if (!visible) {
            setMethod('pix');
            setCheckout(null);
            setCheckoutError(null);
            setMercadoPagoConfig(null);
            setPublicKeyError(null);
            setCardPaymentId(null);
            setCardStatus('idle');
            setCardError(null);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible || method !== 'pix' || checkout) return;

        let cancelled = false;
        setIsCreating(true);
        setCheckoutError(null);

        onCreatePixCheckout?.()
            .then((result) => {
                if (!cancelled) setCheckout(result);
            })
            .catch(() => {
                if (!cancelled) setCheckoutError('Nao foi possivel gerar o pagamento PIX. Tente novamente.');
            })
            .finally(() => {
                if (!cancelled) setIsCreating(false);
            });

        return () => { cancelled = true; };
    }, [visible, method, checkout, onCreatePixCheckout]);

    useEffect(() => {
        if (!visible || method !== 'pix' || !checkout || !onGetCheckoutStatus) return;

        const interval = setInterval(() => {
            onGetCheckoutStatus(checkout.paymentId)
                .then((result) => {
                    if (result.status === 'APPROVED') {
                        onPaymentApproved();
                    }
                })
                .catch(() => {});
        }, 3000);

        return () => clearInterval(interval);
    }, [visible, method, checkout, onGetCheckoutStatus, onPaymentApproved]);

    useEffect(() => {
        if (!visible || mercadoPagoConfig || publicKeyError) return;

        let cancelled = false;
        onGetMercadoPagoPublicKey?.()
            .then((result) => {
                if (!cancelled) setMercadoPagoConfig(result);
            })
            .catch(() => {
                if (!cancelled) setPublicKeyError('Nao foi possivel carregar o pagamento por cartao. Tente novamente.');
            });

        return () => { cancelled = true; };
    }, [visible, mercadoPagoConfig, publicKeyError, onGetMercadoPagoPublicKey]);

    useEffect(() => {
        if (!visible || method !== 'card' || cardStatus !== 'pending' || !cardPaymentId || !onGetCheckoutStatus) return;

        const interval = setInterval(() => {
            onGetCheckoutStatus(cardPaymentId)
                .then((result) => {
                    if (result.status === 'APPROVED') {
                        onPaymentApproved();
                    } else if (result.status === 'REJECTED' || result.status === 'EXPIRED') {
                        setCardStatus('rejected');
                        setCardError('Pagamento nao aprovado. Tente outro cartao.');
                    }
                })
                .catch(() => {});
        }, 3000);

        return () => clearInterval(interval);
    }, [visible, method, cardStatus, cardPaymentId, onGetCheckoutStatus, onPaymentApproved]);

    const handleCardToken = useCallback((result: CardBrickTokenResult) => {
        setCardStatus('submitting');
        setCardError(null);

        onCreateCardCheckout?.(result)
            .then((response) => {
                if (response.status === 'APPROVED') {
                    onPaymentApproved();
                } else if (response.status === 'REJECTED' || response.status === 'EXPIRED') {
                    setCardStatus('rejected');
                    setCardError('Pagamento recusado. Confira os dados do cartao ou tente outro.');
                } else {
                    setCardPaymentId(response.paymentId);
                    setCardStatus('pending');
                }
            })
            .catch(() => {
                setCardStatus('rejected');
                setCardError('Nao foi possivel processar o pagamento. Tente novamente.');
            });
    }, [onCreateCardCheckout, onPaymentApproved]);

    const handleCardError = useCallback((message: string) => {
        setCardError(message);
    }, []);

    const retryCard = useCallback(() => {
        setCardStatus('idle');
        setCardError(null);
        setCardPaymentId(null);
        setBrickKey((key) => key + 1);
    }, []);

    return (
        <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Plano de 100 mensagens/dia</Text>
                        <Pressable onPress={onClose} style={({ pressed }) => [styles.modalCloseButton, pressed ? styles.pressedFeedback : null]}>
                            <X color={colors.textMuted} size={18} />
                        </Pressable>
                    </View>

                    <Text style={styles.modalPrice}>
                        {mercadoPagoConfig ? `R$ ${mercadoPagoConfig.amount.toFixed(2).replace('.', ',')} / mes` : 'R$ -- / mes'}
                    </Text>

                    <View style={styles.tabRow}>
                        <Pressable
                            onPress={() => setMethod('pix')}
                            style={({ pressed }) => [styles.tabButton, method === 'pix' ? styles.tabButtonActive : null, pressed ? styles.pressedFeedback : null]}
                        >
                            <Text style={[styles.tabButtonText, method === 'pix' ? styles.tabButtonTextActive : null]}>PIX</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setMethod('card')}
                            style={({ pressed }) => [styles.tabButton, method === 'card' ? styles.tabButtonActive : null, pressed ? styles.pressedFeedback : null]}
                        >
                            <Text style={[styles.tabButtonText, method === 'card' ? styles.tabButtonTextActive : null]}>Cartao</Text>
                        </Pressable>
                    </View>

                    {method === 'pix' ? (
                        isCreating ? (
                            <View style={styles.modalLoading}>
                                <ActivityIndicator color={colors.brand} />
                                <Text style={styles.modalHint}>Gerando cobranca PIX...</Text>
                            </View>
                        ) : checkoutError ? (
                            <Text style={styles.modalError}>{checkoutError}</Text>
                        ) : checkout ? (
                            <>
                                <Image source={{ uri: `data:image/png;base64,${checkout.qrCodeBase64}` }} style={styles.qrImage} />
                                <Text style={styles.modalHint}>Escaneie o QR code com o app do seu banco ou copie o codigo abaixo</Text>
                                <Text selectable style={styles.pixCode}>{checkout.qrCode}</Text>
                                <View style={styles.modalWaitingRow}>
                                    <ActivityIndicator color={colors.brand} size="small" />
                                    <Text style={styles.modalHint}>Aguardando confirmacao do pagamento...</Text>
                                </View>
                            </>
                        ) : null
                    ) : (
                        <>
                            {publicKeyError ? (
                                <Text style={styles.modalError}>{publicKeyError}</Text>
                            ) : !mercadoPagoConfig ? (
                                <View style={styles.modalLoading}>
                                    <ActivityIndicator color={colors.brand} />
                                </View>
                            ) : (
                                <>
                                    {cardStatus !== 'rejected' ? (
                                        <MercadoPagoCardBrick
                                            amount={mercadoPagoConfig.amount}
                                            key={brickKey}
                                            onError={handleCardError}
                                            onToken={handleCardToken}
                                            publicKey={mercadoPagoConfig.publicKey}
                                        />
                                    ) : null}
                                    {cardStatus === 'submitting' ? (
                                        <View style={styles.modalWaitingRow}>
                                            <ActivityIndicator color={colors.brand} size="small" />
                                            <Text style={styles.modalHint}>Processando pagamento...</Text>
                                        </View>
                                    ) : null}
                                    {cardStatus === 'pending' ? (
                                        <View style={styles.modalWaitingRow}>
                                            <ActivityIndicator color={colors.brand} size="small" />
                                            <Text style={styles.modalHint}>Aguardando confirmacao do pagamento...</Text>
                                        </View>
                                    ) : null}
                                    {cardError ? <Text style={styles.modalError}>{cardError}</Text> : null}
                                    {cardStatus === 'rejected' ? (
                                        <Pressable onPress={retryCard} style={({ pressed }) => [styles.limitBannerButton, pressed ? styles.pressedFeedback : null]}>
                                            <Text style={styles.limitBannerButtonText}>Tentar novamente</Text>
                                        </Pressable>
                                    ) : null}
                                </>
                            )}
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

function ProcessingMessage({ pulse, statusLabel }: { pulse: Animated.Value; statusLabel?: string }) {
    const opacity = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.42, 1]
    });

    return (
        <View style={styles.processingStack}>
            <View style={styles.processingHeader}>
                <Animated.View style={[styles.processingDot, { opacity }]} />
                <Text style={styles.processingText}>{statusLabel || 'Processando sua mensagem'}</Text>
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

function FormattedTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
            <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                    {headers.map((header, index) => (
                        <Text key={`${header}-${index}`} style={[styles.tableCell, styles.tableHeaderCell]}>{header}</Text>
                    ))}
                </View>
                {rows.map((row, rowIndex) => (
                    <View key={`row-${rowIndex}`} style={[styles.tableRow, rowIndex % 2 === 1 ? styles.tableRowAlt : null]}>
                        {row.map((cell, cellIndex) => (
                            <Text key={`cell-${rowIndex}-${cellIndex}`} style={styles.tableCell}>{cell}</Text>
                        ))}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

type FormattedBlock =
    | { type: 'heading'; content: string }
    | { type: 'paragraph'; content: string }
    | { type: 'list'; items: string[] };

function linkLabel(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

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

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = (lines[lineIndex] ?? '').trim();
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
    botBubbleError: {
        backgroundColor: 'rgba(255,218,214,0.35)',
        borderColor: 'rgba(186,26,26,0.28)'
    },
    errorMessageRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: spacing[2]
    },
    errorMessageText: {
        color: '#7a1414',
        flex: 1,
        fontFamily: fonts.sans,
        fontSize: 14,
        lineHeight: 20
    },
    linkRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2]
    },
    linkChip: {
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[1],
        maxWidth: 220,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2
    },
    linkChipText: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 12.5,
        fontWeight: '700'
    },
    followupBlock: {
        gap: spacing[1]
    },
    followupLabelRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4
    },
    followupLabelText: {
        color: colors.textSubtle,
        fontFamily: fonts.medium,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    followupChip: {
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.pill,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    followupChipText: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
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
    tableScroll: {
        marginVertical: spacing[1]
    },
    table: {
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden'
    },
    tableRow: {
        borderTopColor: colors.border,
        borderTopWidth: 1,
        flexDirection: 'row'
    },
    tableHeaderRow: {
        backgroundColor: colors.brandSubtle,
        borderTopWidth: 0
    },
    tableRowAlt: {
        backgroundColor: colors.canvas
    },
    tableCell: {
        color: colors.text,
        fontFamily: fonts.sans,
        fontSize: 13,
        lineHeight: 18,
        minWidth: 96,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    tableHeaderCell: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 11.5,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    quickReplyRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginTop: spacing[1]
    },
    quickReplyChip: {
        backgroundColor: '#ffffff',
        borderColor: colors.brand,
        borderRadius: radii.pill,
        borderWidth: 1.5,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    quickReplyChipText: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
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
    inputShellListening: {
        borderColor: '#c0392b'
    },
    waveformRow: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: spacing[3],
        height: 36
    },
    waveformBars: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        height: 24
    },
    waveformBar: {
        backgroundColor: '#c0392b',
        borderRadius: radii.pill,
        height: 24,
        width: 4
    },
    waveformHint: {
        color: colors.textMuted,
        flex: 1,
        fontFamily: fonts.sans,
        fontSize: 13
    },
    pressedFeedback: {
        opacity: 0.6
    },
    stopButton: {
        backgroundColor: colors.textMuted
    },
    voiceErrorBar: {
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[2],
        maxWidth: 640,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2],
        width: '100%'
    },
    voiceErrorText: {
        color: colors.brandDark,
        flex: 1,
        fontFamily: fonts.sans,
        fontSize: 12.5
    },
    limitBanner: {
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderColor: colors.brand,
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[3],
        maxWidth: 640,
        padding: spacing[3],
        width: '100%'
    },
    limitBannerIcon: {
        alignItems: 'center',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.pill,
        height: 34,
        justifyContent: 'center',
        width: 34
    },
    limitBannerTextGroup: {
        flex: 1,
        gap: 2
    },
    limitBannerTitle: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '800'
    },
    limitBannerSubtitle: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 12
    },
    limitBannerButton: {
        backgroundColor: colors.brand,
        borderRadius: 12,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    limitBannerButtonText: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '800'
    },
    modalOverlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 20, 0.55)',
        flex: 1,
        justifyContent: 'center',
        padding: spacing[4]
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        gap: spacing[3],
        maxWidth: 380,
        padding: spacing[4],
        width: '100%'
    },
    modalHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    tabRow: {
        backgroundColor: colors.canvas,
        borderRadius: 12,
        flexDirection: 'row',
        gap: spacing[1],
        padding: 4
    },
    tabButton: {
        alignItems: 'center',
        borderRadius: 9,
        flex: 1,
        paddingVertical: spacing[2]
    },
    tabButtonActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#101828',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6
    },
    tabButtonText: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
    },
    tabButtonTextActive: {
        color: colors.brandDark
    },
    modalTitle: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 16,
        fontWeight: '800'
    },
    modalCloseButton: {
        alignItems: 'center',
        height: 28,
        justifyContent: 'center',
        width: 28
    },
    modalLoading: {
        alignItems: 'center',
        gap: spacing[2],
        paddingVertical: spacing[4]
    },
    modalError: {
        color: '#c0392b',
        fontFamily: fonts.sans,
        fontSize: 14
    },
    modalPrice: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 20,
        fontWeight: '800'
    },
    qrImage: {
        alignSelf: 'center',
        height: 220,
        width: 220
    },
    modalHint: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 12,
        textAlign: 'center'
    },
    pixCode: {
        backgroundColor: colors.canvas,
        borderRadius: 10,
        color: colors.text,
        fontFamily: fonts.sans,
        fontSize: 11,
        padding: spacing[2]
    },
    modalWaitingRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center'
    }
});

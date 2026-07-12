import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Modal, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { AlertCircle, Bot, Brain, Check, Lock, Mic, Pencil, RotateCcw, Send, Square, X } from 'lucide-react-native';
import type { AiChatMessage } from '@/modules/academic/domain/entities/ai-chat-message';
import type { AiChatReply } from '@/modules/academic/domain/entities/ai-chat-reply';
import { AiDailyLimitReachedError } from '@/shared/errors/ai-daily-limit-reached.error';
import { colors, fonts, radii, spacing } from '@/shared/design-system';
import { MercadoPagoCardBrick } from '@/modules/academic/presentation/views/components/mercadopago-card-brick';
import type { CardBrickTokenResult } from '@/modules/academic/presentation/views/components/mercadopago-card-brick.types';
import type { CreateCardCheckoutRequest } from '@/modules/academic/domain/repositories/ecampus-repository';
import { useSpeechToText, type SpeechToTextErrorReason } from '@/modules/academic/presentation/hooks/use-speech-to-text';

type SendMessageHandlers = {
    onJobId?: (jobId: string) => void;
    onChunk?: (delta: string) => void;
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
    kind?: 'text' | 'processing';
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
    const [dailyLimit, setDailyLimit] = useState<{ limit: number } | null>(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const micPulse = useRef(new Animated.Value(0)).current;
    const [showVoiceError, setShowVoiceError] = useState(false);

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
                    },
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
            setMessages((current) => current.map((message) => (
                message.id === assistantId
                    ? { ...reply.message, id: assistantId, kind: 'text' }
                    : message
            )));
            scrollToBottom(true);
        } catch (error) {
            if (error instanceof AiDailyLimitReachedError) {
                setMessages(historyBase);
                setPrompt(trimmedPrompt);
                setDailyLimit({ limit: error.limit });
            } else if (hasStreamedContent) {
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
                                            <ProcessingMessage pulse={processingPulse} statusLabel={message.statusLabel} />
                                        ) : (
                                            <FormattedAssistantMessage content={message.kind === 'text' ? extractQuickReplies(message.content).cleanedContent : message.content} isTyping={message.id === streamingMessageId} />
                                        )}
                                    </View>

                                    {!isSending && message.kind === 'text' && index === messages.length - 1 && extractQuickReplies(message.content).options.length > 0 ? (
                                        <View style={styles.quickReplyRow}>
                                            {extractQuickReplies(message.content).options.map((option) => (
                                                <Pressable key={option} onPress={() => sendQuickReply(option)} style={styles.quickReplyChip}>
                                                    <Text style={styles.quickReplyChipText}>{option}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    ) : null}

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
                {dailyLimit ? (
                    <View style={styles.limitBanner}>
                        <View style={styles.limitBannerIcon}>
                            <Lock color={colors.brandDark} size={16} />
                        </View>
                        <View style={styles.limitBannerTextGroup}>
                            <Text style={styles.limitBannerTitle}>Limite diario de {dailyLimit.limit} mensagens atingido</Text>
                            <Text style={styles.limitBannerSubtitle}>Assine por R$ 20/mes e tenha 100 mensagens por dia</Text>
                        </View>
                        <Pressable onPress={() => setIsUpgradeModalOpen(true)} style={styles.limitBannerButton}>
                            <Text style={styles.limitBannerButtonText}>Assinar</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        {speech.isListening ? (
                            <View style={styles.voiceListeningBar}>
                                <Animated.View style={[styles.voiceListeningDot, { opacity: micPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]} />
                                <Text numberOfLines={1} style={styles.voiceListeningText}>
                                    {speech.interimText || 'Ouvindo...'}
                                </Text>
                            </View>
                        ) : null}
                        {showVoiceError && speech.errorReason ? (
                            <View style={styles.voiceErrorBar}>
                                <AlertCircle color={colors.brandDark} size={14} />
                                <Text style={styles.voiceErrorText}>{voiceErrorMessage(speech.errorReason)}</Text>
                            </View>
                        ) : null}
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
                            {speech.isSupported ? (
                                <Pressable
                                    accessibilityLabel={speech.isListening ? 'Parar gravacao de voz' : 'Falar para digitar'}
                                    disabled={isSending}
                                    onPress={speech.toggle}
                                    style={[styles.sendButton, styles.micButton, speech.isListening ? styles.micButtonActive : null, isSending ? styles.sendButtonDisabled : null]}
                                >
                                    {speech.isListening ? (
                                        <Square color={colors.inverseText} fill={colors.inverseText} size={13} />
                                    ) : (
                                        <Mic color={colors.inverseText} size={18} />
                                    )}
                                </Pressable>
                            ) : null}
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
                        <Pressable onPress={onClose} style={styles.modalCloseButton}>
                            <X color={colors.textMuted} size={18} />
                        </Pressable>
                    </View>

                    <Text style={styles.modalPrice}>
                        {mercadoPagoConfig ? `R$ ${mercadoPagoConfig.amount.toFixed(2).replace('.', ',')} / mes` : 'R$ -- / mes'}
                    </Text>

                    <View style={styles.tabRow}>
                        <Pressable
                            onPress={() => setMethod('pix')}
                            style={[styles.tabButton, method === 'pix' ? styles.tabButtonActive : null]}
                        >
                            <Text style={[styles.tabButtonText, method === 'pix' ? styles.tabButtonTextActive : null]}>PIX</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setMethod('card')}
                            style={[styles.tabButton, method === 'card' ? styles.tabButtonActive : null]}
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
                                        <Pressable onPress={retryCard} style={styles.limitBannerButton}>
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

                if (block.type === 'table') {
                    return <FormattedTable key={`table-${index}`} headers={block.headers} rows={block.rows} />;
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
    | { type: 'list'; items: string[] }
    | { type: 'table'; headers: string[]; rows: string[][] };

const QUICK_REPLIES_PATTERN = /\n?\[\[OPCOES:\s*([^\]]+)\]\]\s*$/i;

function extractQuickReplies(content: string): { cleanedContent: string; options: string[] } {
    const match = content.match(QUICK_REPLIES_PATTERN);
    if (!match?.[1]) return { cleanedContent: content, options: [] };

    const options = match[1]
        .split('|')
        .map((option) => option.trim())
        .filter(Boolean)
        .slice(0, 4);

    if (options.length < 2) return { cleanedContent: content, options: [] };

    return { cleanedContent: content.slice(0, match.index).trimEnd(), options };
}

function isTableRowLine(line: string): boolean {
    return line.startsWith('|') && line.endsWith('|') && line.length > 1;
}

function isTableSeparatorLine(line: string): boolean {
    return isTableRowLine(line) && line.split('|').slice(1, -1).every((cell) => /^\s*:?-+:?\s*$/.test(cell));
}

function splitTableRow(line: string): string[] {
    return line.slice(1, -1).split('|').map((cell) => cell.trim());
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

        const nextLine = (lines[lineIndex + 1] ?? '').trim();
        if (isTableRowLine(line) && isTableSeparatorLine(nextLine)) {
            flushParagraph();
            flushList();

            const headers = splitTableRow(line);
            const rows: string[][] = [];
            lineIndex += 2;
            while (lineIndex < lines.length && isTableRowLine((lines[lineIndex] ?? '').trim())) {
                rows.push(splitTableRow((lines[lineIndex] ?? '').trim()));
                lineIndex += 1;
            }
            lineIndex -= 1;

            blocks.push({ type: 'table', headers, rows });
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
    },
    micButton: {
        backgroundColor: colors.brandDark
    },
    micButtonActive: {
        backgroundColor: '#c0392b'
    },
    voiceListeningBar: {
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: '#ffffff',
        borderColor: '#c0392b',
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[2],
        maxWidth: 640,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2],
        width: '100%'
    },
    voiceListeningDot: {
        backgroundColor: '#c0392b',
        borderRadius: radii.pill,
        height: 8,
        width: 8
    },
    voiceListeningText: {
        color: colors.text,
        flex: 1,
        fontFamily: fonts.sans,
        fontSize: 13
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

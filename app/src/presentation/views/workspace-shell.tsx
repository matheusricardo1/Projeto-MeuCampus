import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Bell, BellOff, BookOpen, Calendar, CheckCheck, GraduationCap, History, Info, LayoutDashboard, Menu, Send, User, Brain } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients } from '@/presentation/design-system';
import { useLanguage } from '@/presentation/i18n/language-provider';
import type { Workspace } from '@/presentation/views/workspace.types';
import { BootPage } from '@/presentation/views/pages/boot';
import { DashboardPage } from '@/presentation/views/pages/home';
import { GradesPage } from '@/presentation/views/pages/grades';
import { LessonPlanPage } from '@/presentation/views/pages/lesson-plan';
import { LoginPage } from '@/presentation/views/pages/login';
import { ProfilePage } from '@/presentation/views/pages/profile';
import { SchedulePage } from '@/presentation/views/pages/schedule';
import { AIPage } from '@/presentation/views/pages/ai';
import { useResponsiveLayout } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

type ChatHistoryEntry = {
    id: string;
    title: string;
    updatedAt: string;
};

const CHAT_HISTORY_STORAGE_KEY = 'ecampus.ai-chat-history';
const DEFAULT_CHAT_TITLE = 'Desempenho em Calculo I';
const IS_AI_FEATURE_ENABLED = process.env.EXPO_PUBLIC_APP_ENV === 'development';

function readChatHistory(): ChatHistoryEntry[] {
    if (typeof localStorage === 'undefined') return [];

    try {
        const rawValue = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
        if (!rawValue) return [];
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
        return [];
    }
}

function writeChatHistory(history: ChatHistoryEntry[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function clearChatHistory(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
}

export function WorkspaceShell({ workspace }: { workspace: Workspace }) {
    const layout = useResponsiveLayout();
    const { t } = useLanguage();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showChatHistory, setShowChatHistory] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
    const [isAILaunching, setIsAILaunching] = useState(false);
    const pageTransition = useRef(new Animated.Value(1)).current;
    const aiLaunchProgress = useRef(new Animated.Value(0)).current;
    const aiLaunchCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pageScrollRef = useRef<ScrollView>(null);
    const scrollToTop = useCallback(() => {
        const scheduleFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0);
        scheduleFrame(() => {
            pageScrollRef.current?.scrollTo({ animated: false, y: 0 });
        });
    }, []);

    const tabActions = {
        grades: workspace.loadGrades,
        home: workspace.refreshDashboard,
        lessonPlan: workspace.loadLessonPlanSubjects,
        profile: workspace.loadProfile,
        schedule: workspace.loadSchedule,
        ai: async () => {} // AI tab doesn't require data loading
    } satisfies Record<Workspace['activeTab'] | 'ai', () => Promise<void>>;
    const tabLabels = {
        grades: t('nav.grades'),
        home: t('nav.panel'),
        lessonPlan: t('nav.subjects'),
        profile: t('nav.profile'),
        schedule: t('nav.schedule'),
        ai: t('nav.ai')
    } satisfies Record<Workspace['activeTab'] | 'ai', string>;
    const bottomTabs = [
        { id: 'home' as const, label: t('nav.panel'), icon: LayoutDashboard },
        { id: 'lessonPlan' as const, label: t('nav.subjects'), icon: BookOpen },
        ...(IS_AI_FEATURE_ENABLED ? [{ id: 'ai' as const, label: t('nav.ai'), icon: Brain }] : []),
        { id: 'schedule' as const, label: t('nav.schedule'), icon: Calendar },
        { id: 'profile' as const, label: t('nav.profile'), icon: User }
    ];
    const activeTabLabel = tabLabels[workspace.activeTab as keyof typeof tabLabels];
    const openWorkspaceTab = (tabId: Workspace['activeTab'] | 'ai') => {
        setShowNotifications(false);
        setShowChatHistory(false);

        if (tabId === 'ai' && !IS_AI_FEATURE_ENABLED) {
            workspace.openTab('home');
            scrollToTop();
            return;
        }

        if (tabId === 'ai' && workspace.activeTab !== 'ai') {
            if (aiLaunchCleanupRef.current) {
                clearTimeout(aiLaunchCleanupRef.current);
                aiLaunchCleanupRef.current = null;
            }

            aiLaunchProgress.stopAnimation();
            aiLaunchProgress.setValue(0);
            setIsAILaunching(true);
            workspace.openTab('ai' as Workspace['activeTab']);
            scrollToTop();

            Animated.timing(aiLaunchProgress, {
                toValue: 1,
                duration: 520,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true
            }).start(({ finished }) => {
                if (!finished) return;

                aiLaunchCleanupRef.current = setTimeout(() => {
                    setIsAILaunching(false);
                    aiLaunchProgress.setValue(0);
                    aiLaunchCleanupRef.current = null;
                }, 120);
            });
            return;
        }

        if (isAILaunching) {
            if (aiLaunchCleanupRef.current) {
                clearTimeout(aiLaunchCleanupRef.current);
                aiLaunchCleanupRef.current = null;
            }

            aiLaunchProgress.stopAnimation();
            aiLaunchProgress.setValue(0);
            setIsAILaunching(false);
        }

        workspace.openTab(tabId as Workspace['activeTab']);
        scrollToTop();
    };
    const openNotifications = () => {
        setShowNotifications(true);
        scrollToTop();
    };
    const leaveAIChat = () => openWorkspaceTab('home');
    const closeChatHistory = () => setShowChatHistory(false);
    const refreshPage = showNotifications ? async () => undefined : (tabActions[workspace.activeTab as keyof typeof tabActions] || (() => Promise.resolve()));
    const isAIPage = IS_AI_FEATURE_ENABLED && !showNotifications && workspace.activeTab === 'ai';
    const bottomNavInset = isAIPage ? 0 : layout.isTablet ? 88 : 96;
    const chatTitle = chatHistory[0]?.title || DEFAULT_CHAT_TITLE;
    const pageTransitionKey = showNotifications ? 'notifications' : workspace.activeTab;

    useEffect(() => {
        if (!workspace.isAuthenticated) {
            clearChatHistory();
            setChatHistory([]);
            setShowChatHistory(false);
            return;
        }

        setChatHistory(readChatHistory());
    }, [workspace.isAuthenticated]);

    useEffect(() => {
        if (IS_AI_FEATURE_ENABLED || workspace.activeTab !== 'ai') return;
        workspace.openTab('home');
    }, [workspace]);

    useEffect(() => {
        if (!isAIPage || chatHistory.length > 0) return;

        const initialHistory = [{
            id: 'current-chat',
            title: DEFAULT_CHAT_TITLE,
            updatedAt: new Date().toISOString()
        }];

        setChatHistory(initialHistory);
        writeChatHistory(initialHistory);
    }, [chatHistory.length, isAIPage]);

    useEffect(() => {
        if (pageTransitionKey === 'ai') {
            pageTransition.setValue(1);
            return;
        }

        pageTransition.setValue(0);
        const animation = Animated.timing(pageTransition, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
        });

        animation.start();
        return () => animation.stop();
    }, [pageTransition, pageTransitionKey]);

    useEffect(() => {
        return () => {
            if (aiLaunchCleanupRef.current) {
                clearTimeout(aiLaunchCleanupRef.current);
            }
        };
    }, []);

    if (!workspace.isReady) return <BootPage />;
    if (!workspace.isAuthenticated) return <LoginPage workspace={workspace} />;

    const renderHeaderContent = () => {
        if (isAIPage) {
            return (
                <>
                    <View style={styles.headerIdentity}>
                        <Pressable onPress={leaveAIChat} style={styles.headerNotificationButton}>
                            <ArrowLeft color={colors.textMuted} size={22} />
                        </Pressable>
                        <Pressable onPress={() => setShowChatHistory((current) => !current)} style={styles.headerNotificationButton}>
                            <History color={colors.textMuted} size={21} />
                        </Pressable>
                        <Text numberOfLines={1} style={styles.headerTitle}>{chatTitle}</Text>
                    </View>
                </>
            );
        }

        if (layout.isTablet) {
            return (
                <>
                    <View style={styles.headerIdentity}>
                        <GraduationCap color={colors.brandDark} size={26} />
                        <View style={styles.headerTextStack}>
                            <Text numberOfLines={1} style={styles.headerBrandTitle}>Meu Campus</Text>
                            <Text numberOfLines={1} style={styles.headerSubtitle}>{showNotifications ? t('notifications.title') : activeTabLabel}</Text>
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        <Pressable onPress={openNotifications} style={styles.headerNotificationButton}>
                            <Bell color={colors.textMuted} size={22} />
                        </Pressable>
                    </View>
                </>
            );
        }

        return (
            <>
                <View style={styles.headerIdentity}>
                    <GraduationCap color={colors.brandDark} size={26} />
                    <Text numberOfLines={1} style={styles.headerBrandTitle}>{showNotifications ? t('notifications.title') : 'Meu Campus'}</Text>
                </View>

                <View style={styles.headerActions}>
                    <Pressable onPress={openNotifications} style={styles.headerNotificationButton}>
                        <Bell color={colors.textMuted} size={22} />
                    </Pressable>
                </View>
            </>
        );
    };
    const aiLaunchBarStyle = {
        opacity: aiLaunchProgress.interpolate({
            inputRange: [0, 0.18, 1],
            outputRange: [0, 1, 1]
        }),
        transform: [{
            translateY: aiLaunchProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0]
            })
        }]
    };
    const aiLaunchPromptContentStyle = {
        opacity: aiLaunchProgress.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0, 1, 1]
        })
    };
    const sharedBottomNav = isAIPage || isAILaunching ? null : (
        <View style={styles.bottomNavShell}>
            <View style={[styles.bottomNav, layout.isTablet ? styles.bottomNavDesktop : null]}>
                {bottomTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = !showNotifications && workspace.activeTab === tab.id;
                    return (
                        <Pressable key={tab.id} onPress={() => openWorkspaceTab(tab.id)} style={[styles.navItem, layout.isTablet ? styles.navItemDesktop : null, active ? styles.navItemActive : null]}>
                            <Icon color={active ? colors.brandMuted : colors.textMuted} size={20} />
                            <Text numberOfLines={1} style={[styles.navText, active ? styles.navTextActive : null]}>{tab.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
    const pageContent = isAIPage ? (
        <View style={styles.flexScroll}>
            <AIPage bottomInset={bottomNavInset} hidePromptInput={isAILaunching} onChatScroll={closeChatHistory} onSendMessage={workspace.sendAiChatMessage} />
        </View>
    ) : (
        <ScrollView
            ref={pageScrollRef}
            contentContainerStyle={[styles.content, { paddingBottom: layout.isTablet ? 112 : 112, paddingHorizontal: layout.pagePadding }]}
            refreshControl={<RefreshControl refreshing={!showNotifications && workspace.isLoading} onRefresh={() => void refreshPage()} tintColor={colors.brand} />}
            showsVerticalScrollIndicator={Platform.OS === 'web' && !layout.isMobileWeb}
            style={Platform.OS === 'web' ? styles.webFreeScroll : styles.flexScroll}
        >
            <View style={[styles.contentShell, { maxWidth: layout.contentMaxWidth }]}>
                {showNotifications ? <NotificationsPage /> : (
                    <>
                        {workspace.error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{workspace.error}</Text></View> : null}
                        {workspace.activeTab === 'home' ? <DashboardPage workspace={workspace} /> : null}
                        {workspace.activeTab === 'profile' ? <ProfilePage profile={workspace.profile} onRefresh={workspace.loadProfile} onLogout={workspace.logout} loading={workspace.isLoading} /> : null}
                        {workspace.activeTab === 'schedule' ? <SchedulePage schedule={workspace.schedule} onRefresh={workspace.loadSchedule} loading={workspace.isLoading} /> : null}
                        {workspace.activeTab === 'grades' ? <GradesPage grades={workspace.grades} input={workspace.gradesInput} loading={workspace.isLoading} onChange={workspace.setGradesInput} onRefresh={workspace.loadGrades} /> : null}
                        {workspace.activeTab === 'lessonPlan' ? <LessonPlanPage currentGradesInput={workspace.currentGradesInput} grades={workspace.grades} gradesInput={workspace.gradesInput} items={workspace.lessonPlan} loading={workspace.isLoading} onChangeGradesInput={workspace.changeGradesInputAndLoad} onChangeSubjectCode={workspace.changeLessonPlanSubject} onNavigateScreen={scrollToTop} onRefresh={workspace.loadLessonPlan} onRefreshSubjects={workspace.loadLessonPlanSubjects} profile={workspace.profile} schedule={workspace.schedule} selectedSubjectCode={workspace.selectedLessonPlanSubjectCode} subjects={workspace.lessonPlanSubjects} /> : null}
                    </>
                )}
            </View>
        </ScrollView>
    );

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
            <LinearGradient colors={gradients.app} style={StyleSheet.absoluteFill} />
            <View style={[styles.appShell, layout.isDesktop ? styles.appShellDesktop : null]}>
                <View style={styles.headerShell}>
                    <View style={styles.header}>
                        {renderHeaderContent()}
                    </View>
                </View>

                <Animated.View
                    style={[
                        styles.pageTransition,
                        {
                            opacity: pageTransition,
                            transform: [{
                                translateY: pageTransition.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [10, 0]
                                })
                            }]
                        }
                    ]}
                >
                    {pageContent}
                </Animated.View>
                {isAIPage && showChatHistory ? (
                    <>
                        <Pressable onPress={closeChatHistory} style={styles.chatHistoryDismissLayer} />
                        <View style={styles.chatHistorySidebar}>
                            <Text style={styles.chatHistoryTitle}>Historico</Text>
                            <View style={styles.chatHistoryList}>
                                {chatHistory.map((chat) => (
                                    <Pressable key={chat.id} onPress={closeChatHistory} style={styles.chatHistoryItem}>
                                        <Text numberOfLines={1} style={styles.chatHistoryItemTitle}>{chat.title}</Text>
                                        <Text numberOfLines={1} style={styles.chatHistoryItemMeta}>Sessao atual</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </>
                ) : null}

                {isAILaunching ? (
                    <Animated.View pointerEvents="none" style={[styles.aiLaunchOverlay, aiLaunchBarStyle]}>
                        <View style={[styles.aiLaunchBar, layout.isTablet ? styles.aiLaunchBarDesktop : null]}>
                            <View style={styles.aiLaunchPrompt}>
                                <Animated.View style={[styles.aiLaunchPromptContent, aiLaunchPromptContentStyle]}>
                                    <Brain color={colors.brand} size={18} />
                                    <Text numberOfLines={1} style={styles.aiLaunchPromptText}>Pergunte qualquer coisa...</Text>
                                </Animated.View>
                            </View>
                            <View style={styles.aiLaunchSendButton}>
                                <Send color={colors.inverseText} size={18} />
                            </View>
                        </View>
                    </Animated.View>
                ) : null}

                {sharedBottomNav}
            </View>
        </SafeAreaView>
    );
}

function NotificationsPage() {
    const { t } = useLanguage();

    return (
        <View style={styles.notificationsPage}>
            <View style={styles.notificationsTopRow}>
                <View style={styles.notificationsTitleRow}>
                    <View style={styles.notificationsMenuIcon}>
                        <Menu color="#003215" size={22} />
                    </View>
                    <Text style={styles.notificationsTitle}>{t('notifications.title')}</Text>
                </View>
                <Pressable style={styles.notificationsReadButton}>
                    <CheckCheck color="#003215" size={17} />
                    <Text style={styles.notificationsReadButtonText}>{t('notifications.markRead')}</Text>
                </Pressable>
            </View>

            <View style={styles.notificationsSection}>
                <Text style={styles.notificationsSectionLabel}>{t('notifications.today')}</Text>
                <View style={styles.notificationsEmptyCard}>
                    <View style={styles.notificationsEmptyIcon}>
                        <BellOff color="#414941" size={42} />
                    </View>
                    <Text style={styles.notificationsEmptyTitle}>{t('notifications.emptyTitle')}</Text>
                    <Text style={styles.notificationsEmptyText}>{t('notifications.emptyText')}</Text>
                </View>
            </View>

            <View style={styles.notificationsSection}>
                <Text style={styles.notificationsSectionLabel}>{t('notifications.previous')}</Text>
                <View style={styles.notificationsHintCard}>
                    <View style={styles.notificationsHintIcon}>
                        <Info color="#003215" size={22} />
                    </View>
                    <View style={styles.notificationsHintText}>
                        <Text style={styles.notificationsHintTitle}>{t('notifications.emptyHistoryTitle')}</Text>
                        <Text style={styles.notificationsHintDescription}>{t('notifications.emptyHistoryDescription')}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

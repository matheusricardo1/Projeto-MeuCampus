import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Bell, BookOpen, Calendar, GraduationCap, History, LayoutDashboard, Mic, Send, Sparkles, User, Brain } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Slot, usePathname, useRouter } from 'expo-router';
import { colors, gradients } from '@/shared/design-system';
import { useLanguage } from '@/shared/i18n/language-provider';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';
import { useResponsiveLayout } from '@/modules/academic/presentation/views/workspace.utils';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';
import { aiInputBarStyles } from '@/modules/academic/presentation/views/pages/ai-input-bar.styles';
import { AiOnboardingModal } from '@/modules/academic/presentation/views/components';
import { hapticTap } from '@/shared/haptics';

type TabId = 'home' | 'lessonPlan' | 'ai' | 'schedule' | 'community' | 'profile' | 'notifications';

/** UI-only chrome state routes need from this layout — not workspace data, so it stays out of WorkspaceContext. */
interface TabsChrome {
    bottomNavInset: number;
    isAILaunching: boolean;
    closeChatHistory: () => void;
    scrollToTop: () => void;
}

const TabsChromeContext = createContext<TabsChrome | null>(null);

export function useTabsChrome(): TabsChrome {
    const chrome = useContext(TabsChromeContext);
    if (!chrome) {
        throw new Error('useTabsChrome must be used within the (tabs) layout.');
    }

    return chrome;
}

type ChatHistoryEntry = {
    id: string;
    title: string;
    updatedAt: string;
};

const CHAT_HISTORY_STORAGE_KEY = 'ecampus.ai-chat-history';
const AI_ONBOARDING_STORAGE_KEY = 'ecampus.ai-onboarding-seen';
const DEFAULT_CHAT_TITLE = 'Meu Campus AI';
const IS_AI_FEATURE_ENABLED = true;

const TAB_PATHS: Record<Exclude<TabId, 'notifications'>, string> = {
    home: '/',
    lessonPlan: '/lesson-plan',
    ai: '/ai',
    schedule: '/schedule',
    community: '/community',
    profile: '/profile'
};

function getActiveTab(pathname: string): TabId {
    if (pathname === '/') return 'home';
    if (pathname.startsWith('/schedule')) return 'schedule';
    if (pathname.startsWith('/community')) return 'community';
    if (pathname.startsWith('/profile')) return 'profile';
    if (pathname.startsWith('/notifications')) return 'notifications';
    if (pathname.startsWith('/ai')) return 'ai';
    if (pathname.startsWith('/lesson-plan')) return 'lessonPlan';
    return 'home';
}

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

function hasSeenAiOnboarding(): boolean {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(AI_ONBOARDING_STORAGE_KEY) === '1';
}

function markAiOnboardingSeen(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(AI_ONBOARDING_STORAGE_KEY, '1');
}

// A small pulsing "look here" ring around the AI nav icon, shown only until
// the user's first visit to the AI tab — driven the same manual-reset way as
// the skeleton shimmer (see ui.tsx): Animated.loop's built-in reset was
// unreliable here, an explicit setValue(0) before each restart is not.
function NavAiBadge() {
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let isActive = true;

        const runCycle = () => {
            pulse.setValue(0);
            Animated.timing(pulse, {
                toValue: 1,
                duration: 1400,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true
            }).start(({ finished }) => {
                if (isActive && finished) runCycle();
            });
        };

        runCycle();
        return () => {
            isActive = false;
            pulse.stopAnimation();
        };
    }, [pulse]);

    const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
    const ringOpacity = pulse.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.55, 0.18, 0] });

    return (
        <View pointerEvents="none" style={styles.navAiBadgeWrap}>
            <Animated.View style={[styles.navAiBadgeRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
            <View style={styles.navAiBadgeDot} />
        </View>
    );
}

export default function TabsLayout() {
    const workspace = useWorkspace();
    const layout = useResponsiveLayout();
    const { t } = useLanguage();
    const router = useRouter();
    const pathname = usePathname();
    const activeTab = getActiveTab(pathname);
    const [showChatHistory, setShowChatHistory] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
    const [isAILaunching, setIsAILaunching] = useState(false);
    const [aiIntroSeen, setAiIntroSeen] = useState(() => hasSeenAiOnboarding());
    const [showAiOnboarding, setShowAiOnboarding] = useState(false);
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

    // Every navigation is a fresh entry in the browser's history (see the
    // route files, which use router.push, not replace) — so every entry
    // into a page should start scrolled to the top, matching what a user
    // expects from a real page-to-page navigation.
    useEffect(() => {
        scrollToTop();
    }, [pathname, scrollToTop]);

    const tabLabels: Record<TabId, string> = {
        home: t('nav.panel'),
        lessonPlan: t('nav.subjects'),
        profile: t('nav.profile'),
        schedule: t('nav.schedule'),
        community: t('nav.community'),
        ai: t('nav.ai'),
        notifications: t('notifications.title')
    };
    const bottomTabs = [
        { id: 'home' as const, label: t('nav.panel'), icon: LayoutDashboard },
        { id: 'lessonPlan' as const, label: t('nav.subjects'), icon: BookOpen },
        ...(IS_AI_FEATURE_ENABLED ? [{ id: 'ai' as const, label: t('nav.ai'), icon: Brain }] : []),
        { id: 'schedule' as const, label: t('nav.schedule'), icon: Calendar }
        // Comunidade is not launched in the navbar yet — it opens from the
        // Profile screen and runs full-screen (no bottom nav). See isCommunityPage.
    ];
    const activeTabLabel = tabLabels[activeTab];
    const tabActions: Record<TabId, () => Promise<void>> = {
        home: workspace.refreshDashboard,
        lessonPlan: workspace.loadLessonPlanSubjects,
        profile: workspace.loadProfile,
        schedule: workspace.loadSchedule,
        community: async () => undefined,
        ai: async () => undefined,
        notifications: async () => undefined
    };
    const navigateToTab = (tabId: Exclude<TabId, 'notifications'>) => {
        setShowChatHistory(false);
        if (tabId !== activeTab) hapticTap();

        if (tabId === 'ai' && !IS_AI_FEATURE_ENABLED) {
            router.push('/');
            return;
        }

        if (tabId === 'ai' && activeTab !== 'ai') {
            if (aiLaunchCleanupRef.current) {
                clearTimeout(aiLaunchCleanupRef.current);
                aiLaunchCleanupRef.current = null;
            }

            aiLaunchProgress.stopAnimation();
            aiLaunchProgress.setValue(0);
            setIsAILaunching(true);
            router.push('/ai');

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

        if (pathname !== TAB_PATHS[tabId]) {
            router.push(TAB_PATHS[tabId]);
        }
    };
    const openNotifications = () => {
        if (activeTab !== 'notifications') {
            router.push('/notifications');
        }
    };
    const openProfile = () => navigateToTab('profile');
    const leaveAIChat = () => navigateToTab('home');
    const closeChatHistory = () => setShowChatHistory(false);
    const isAIPage = IS_AI_FEATURE_ENABLED && activeTab === 'ai';
    // Community runs its own full-height immersive feed (like the AI page) and,
    // while not launched in the navbar, opens full-screen with no bottom nav.
    const isCommunityPage = activeTab === 'community';
    // Course details/content pages ship their own top bar with a back button —
    // the shared "Meu Campus" header and bottom nav would just be redundant chrome there.
    const isCourseDetailsPage = pathname.startsWith('/lesson-plan/');
    const bottomNavInset = isAIPage || isCommunityPage || isCourseDetailsPage ? 0 : layout.isTablet ? 88 : 96;
    const chatTitle = chatHistory[0]?.title || DEFAULT_CHAT_TITLE;

    useEffect(() => {
        if (!isAIPage || aiIntroSeen) return;

        setShowAiOnboarding(true);
        markAiOnboardingSeen();
        setAiIntroSeen(true);
    }, [isAIPage, aiIntroSeen]);

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
        if (activeTab === 'ai') {
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
    }, [pageTransition, pathname, activeTab]);

    useEffect(() => {
        return () => {
            if (aiLaunchCleanupRef.current) {
                clearTimeout(aiLaunchCleanupRef.current);
            }
        };
    }, []);

    const renderHeaderContent = () => {
        if (isAIPage) {
            return (
                <View style={styles.headerIdentity}>
                    <Pressable onPress={leaveAIChat} style={({ pressed }) => [styles.headerNotificationButton, pressed ? styles.pressedFeedback : null]}>
                        <ArrowLeft color={colors.textMuted} size={22} />
                    </Pressable>
                    <Pressable onPress={() => setShowChatHistory((current) => !current)} style={({ pressed }) => [styles.headerNotificationButton, pressed ? styles.pressedFeedback : null]}>
                        <History color={colors.textMuted} size={21} />
                    </Pressable>
                    <Text numberOfLines={1} style={styles.headerTitle}>{chatTitle}</Text>
                </View>
            );
        }

        if (layout.isTablet) {
            return (
                <>
                    <View style={styles.headerIdentity}>
                        <GraduationCap color={colors.brandDark} size={26} />
                        <View style={styles.headerTextStack}>
                            <Text numberOfLines={1} style={styles.headerBrandTitle}>Meu Campus</Text>
                            <Text numberOfLines={1} style={styles.headerSubtitle}>{activeTab === 'notifications' ? t('notifications.title') : activeTabLabel}</Text>
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        <Pressable onPress={openNotifications} style={({ pressed }) => [styles.headerNotificationButton, pressed ? styles.pressedFeedback : null]}>
                            <Bell color={colors.textMuted} size={22} />
                        </Pressable>
                        <Pressable onPress={openProfile} style={({ pressed }) => [styles.headerNotificationButton, activeTab === 'profile' ? styles.headerActionActive : null, pressed ? styles.pressedFeedback : null]}>
                            <User color={activeTab === 'profile' ? colors.brand : colors.textMuted} size={22} />
                        </Pressable>
                    </View>
                </>
            );
        }

        return (
            <>
                <View style={styles.headerIdentity}>
                    <GraduationCap color={colors.brandDark} size={26} />
                    <Text numberOfLines={1} style={styles.headerBrandTitle}>{activeTab === 'notifications' ? t('notifications.title') : 'Meu Campus'}</Text>
                </View>

                <View style={styles.headerActions}>
                    <Pressable onPress={openNotifications} style={({ pressed }) => [styles.headerNotificationButton, pressed ? styles.pressedFeedback : null]}>
                        <Bell color={colors.textMuted} size={22} />
                    </Pressable>
                    <Pressable onPress={openProfile} style={({ pressed }) => [styles.headerNotificationButton, activeTab === 'profile' ? styles.headerActionActive : null, pressed ? styles.pressedFeedback : null]}>
                        <User color={activeTab === 'profile' ? colors.brand : colors.textMuted} size={22} />
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
    const sharedBottomNav = isAIPage || isAILaunching || isCourseDetailsPage || isCommunityPage ? null : (
        <View style={styles.bottomNavShell}>
            <View style={[styles.bottomNav, layout.isTablet ? styles.bottomNavDesktop : null]}>
                {bottomTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <Pressable key={tab.id} onPress={() => navigateToTab(tab.id)} style={({ pressed }) => [styles.navItem, layout.isTablet ? styles.navItemDesktop : null, active ? styles.navItemActive : null, pressed ? styles.navItemPressed : null]}>
                            <View style={styles.navIconWrap}>
                                <Icon color={active ? colors.brandMuted : colors.textMuted} size={20} />
                                {tab.id === 'ai' ? (
                                    <View pointerEvents="none" style={styles.navAiSparkle}>
                                        <Sparkles color="#febf31" fill="#febf31" size={10} />
                                    </View>
                                ) : null}
                                {tab.id === 'ai' && !aiIntroSeen ? <NavAiBadge /> : null}
                            </View>
                            <Text numberOfLines={1} style={[styles.navText, active ? styles.navTextActive : null]}>{tab.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
    const pageContent = (isAIPage || isCommunityPage) ? (
        <View style={styles.flexScroll}>
            <Slot />
        </View>
    ) : (
        <ScrollView
            ref={pageScrollRef}
            contentContainerStyle={[styles.content, { paddingBottom: isCourseDetailsPage ? 16 : 112, paddingHorizontal: layout.pagePadding }]}
            refreshControl={<RefreshControl refreshing={activeTab !== 'notifications' && workspace.isLoading} onRefresh={() => void tabActions[activeTab]()} tintColor={colors.brand} />}
            showsVerticalScrollIndicator={Platform.OS === 'web' && !layout.isMobileWeb}
            style={Platform.OS === 'web' ? styles.webFreeScroll : styles.flexScroll}
        >
            <View style={[styles.contentShell, { maxWidth: layout.contentMaxWidth }]}>
                {activeTab !== 'notifications' && workspace.error ? (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>{workspace.error}</Text>
                        {workspace.isErrorRetryable ? (
                            <Pressable
                                onPress={() => { hapticTap(); void tabActions[activeTab](); }}
                                style={({ pressed }) => [styles.errorRetryButton, pressed ? styles.pressedFeedback : null]}
                            >
                                <Text style={styles.errorRetryText}>{t('common.retry')}</Text>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}
                <Slot />
            </View>
        </ScrollView>
    );

    return (
        <TabsChromeContext.Provider value={{ bottomNavInset, isAILaunching, closeChatHistory, scrollToTop }}>
        <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
            <LinearGradient colors={gradients.app} style={StyleSheet.absoluteFill} />
            <View style={[styles.appShell, layout.isDesktop ? styles.appShellDesktop : null]}>
                {isCourseDetailsPage ? null : (
                    <View style={styles.headerShell}>
                        <View style={styles.header}>
                            {renderHeaderContent()}
                        </View>
                    </View>
                )}

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
                                    <Pressable key={chat.id} onPress={closeChatHistory} style={({ pressed }) => [styles.chatHistoryItem, pressed ? styles.pressedFeedback : null]}>
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
                        {/* Mirrors the real AI chat input dock (ai.tsx) exactly via the
                            shared aiInputBarStyles — this fake bar stands in for it during
                            the tab-launch transition, so it must never visually drift. */}
                        <View style={[aiInputBarStyles.inputBar, layout.isTablet ? styles.aiLaunchBarDesktop : null]}>
                            <View style={aiInputBarStyles.inputShell}>
                                <Animated.View style={[styles.aiLaunchPromptContent, aiLaunchPromptContentStyle]}>
                                    <Brain color={colors.brand} size={18} />
                                    <Text numberOfLines={1} style={aiInputBarStyles.input}>Pergunte qualquer coisa...</Text>
                                </Animated.View>
                            </View>
                            <View style={[aiInputBarStyles.sendButton, aiInputBarStyles.micButton]}>
                                <Mic color={colors.inverseText} size={18} />
                            </View>
                            <View style={aiInputBarStyles.sendButton}>
                                <Send color={colors.inverseText} size={18} />
                            </View>
                        </View>
                    </Animated.View>
                ) : null}

                {sharedBottomNav}
            </View>

            <AiOnboardingModal onDismiss={() => setShowAiOnboarding(false)} visible={showAiOnboarding} />
        </SafeAreaView>
        </TabsChromeContext.Provider>
    );
}

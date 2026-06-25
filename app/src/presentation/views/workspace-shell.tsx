import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, BellOff, BookOpen, Calendar, ChartColumn, CheckCheck, ClipboardList, GraduationCap, IdCard, Info, Landmark, LayoutDashboard, Menu, User } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients } from '@/presentation/design-system';
import type { Workspace } from '@/presentation/views/workspace.types';
import { BootPage } from '@/presentation/views/pages/boot';
import { DashboardPage } from '@/presentation/views/pages/home';
import { GradesPage } from '@/presentation/views/pages/grades';
import { LessonPlanPage } from '@/presentation/views/pages/lesson-plan';
import { LoginPage } from '@/presentation/views/pages/login';
import { ProfilePage } from '@/presentation/views/pages/profile';
import { SchedulePage } from '@/presentation/views/pages/schedule';
import { useResponsiveLayout } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function WorkspaceShell({ workspace }: { workspace: Workspace }) {
    const layout = useResponsiveLayout();
    const [showNotifications, setShowNotifications] = useState(false);
    const pageScrollRef = useRef<ScrollView>(null);

    if (!workspace.isReady) return <BootPage />;
    if (!workspace.isAuthenticated) return <LoginPage workspace={workspace} />;

    const tabs = [
        { id: 'home' as const, label: 'Inicio', icon: Landmark, action: workspace.refreshDashboard },
        { id: 'profile' as const, label: 'Perfil', icon: IdCard, action: workspace.loadProfile },
        { id: 'schedule' as const, label: 'Horario', icon: Calendar, action: workspace.loadSchedule },
        { id: 'grades' as const, label: 'Notas', icon: ChartColumn, action: workspace.loadGrades },
        { id: 'lessonPlan' as const, label: 'Plano', icon: ClipboardList, action: workspace.loadLessonPlanSubjects }
    ];
    const bottomTabs = [
        { id: 'home' as const, label: 'Painel', icon: LayoutDashboard },
        { id: 'lessonPlan' as const, label: 'Cursos', icon: BookOpen },
        { id: 'schedule' as const, label: 'Horario', icon: Calendar },
        { id: 'profile' as const, label: 'Perfil', icon: User }
    ];
    const activeTab = tabs.find((tab) => tab.id === workspace.activeTab) || tabs[0]!;
    const scrollToTop = useCallback(() => {
        requestAnimationFrame(() => {
            pageScrollRef.current?.scrollTo({ animated: false, y: 0 });
        });
    }, []);
    const openWorkspaceTab = (tabId: Workspace['activeTab']) => {
        setShowNotifications(false);
        workspace.openTab(tabId);
        scrollToTop();
    };
    const openNotifications = () => {
        setShowNotifications(true);
        scrollToTop();
    };
    const refreshPage = showNotifications ? async () => undefined : activeTab.action;
    const sidebarNav = (
        <View style={styles.sidebar}>
            <View style={styles.sidebarBrand}>
                <View style={styles.sidebarLogo}>
                    <GraduationCap color={colors.inverseText} size={22} />
                </View>
                <View style={styles.sidebarBrandText}>
                    <Text numberOfLines={1} style={styles.sidebarTitle}>Meu Campus</Text>
                    <Text numberOfLines={1} style={styles.sidebarSubtitle}>Area academica</Text>
                </View>
            </View>

            <View style={styles.sidebarNav}>
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = workspace.activeTab === tab.id;
                return (
                    <Pressable key={tab.id} onPress={() => openWorkspaceTab(tab.id)} style={[styles.sidebarNavItem, active ? styles.sidebarNavItemActive : null]}>
                        <Icon color={active ? colors.inverseText : colors.textMuted} size={20} />
                        <Text numberOfLines={1} style={[styles.sidebarNavText, active ? styles.sidebarNavTextActive : null]}>{tab.label}</Text>
                    </Pressable>
                );
            })}
            </View>
        </View>
    );
    const pageContent = (
        <ScrollView
            ref={pageScrollRef}
            contentContainerStyle={[styles.content, { paddingBottom: layout.isTablet ? 32 : 112, paddingHorizontal: layout.pagePadding }]}
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
                {layout.isTablet ? (
                    <View style={styles.sidebarLayout}>
                        {sidebarNav}
                        <View style={styles.sidebarMain}>
                            <View style={styles.sidebarHeader}>
                                <Text numberOfLines={1} style={styles.headerTitle}>{showNotifications ? 'Notificacoes' : activeTab.label}</Text>
                                <Pressable onPress={openNotifications} style={styles.headerNotificationButton}>
                                    <Bell color={colors.textMuted} size={22} />
                                </Pressable>
                            </View>
                            {pageContent}
                        </View>
                    </View>
                ) : (
                    <>
                        <View style={styles.headerShell}>
                            <View style={styles.header}>
                                <View style={styles.headerIdentity}>
                                    <GraduationCap color={colors.brandDark} size={26} />
                                    <Text numberOfLines={1} style={styles.headerBrandTitle}>{showNotifications ? 'Notificacoes' : 'Meu Campus'}</Text>
                                </View>

                                <View style={styles.headerActions}>
                                    <Pressable onPress={openNotifications} style={styles.headerNotificationButton}>
                                        <Bell color={colors.textMuted} size={22} />
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        {pageContent}
                    </>
                )}

                {layout.showBottomNav ? (
                    <View style={styles.bottomNavShell}>
                        <View style={styles.bottomNav}>
                            {bottomTabs.map((tab) => {
                                const Icon = tab.icon;
                                const active = !showNotifications && workspace.activeTab === tab.id;
                                return (
                                    <Pressable key={tab.id} onPress={() => openWorkspaceTab(tab.id)} style={[styles.navItem, !showNotifications && active ? styles.navItemActive : null]}>
                                        <Icon color={active ? colors.brandMuted : colors.textMuted} size={20} />
                                        <Text numberOfLines={1} style={[styles.navText, active ? styles.navTextActive : null]}>{tab.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                ) : null}
            </View>
        </SafeAreaView>
    );
}

function NotificationsPage() {
    return (
        <View style={styles.notificationsPage}>
            <View style={styles.notificationsTopRow}>
                <View style={styles.notificationsTitleRow}>
                    <View style={styles.notificationsMenuIcon}>
                        <Menu color="#003215" size={22} />
                    </View>
                    <Text style={styles.notificationsTitle}>Notificacoes</Text>
                </View>
                <Pressable style={styles.notificationsReadButton}>
                    <CheckCheck color="#003215" size={17} />
                    <Text style={styles.notificationsReadButtonText}>Marcar lidas</Text>
                </Pressable>
            </View>

            <View style={styles.notificationsSection}>
                <Text style={styles.notificationsSectionLabel}>Hoje</Text>
                <View style={styles.notificationsEmptyCard}>
                    <View style={styles.notificationsEmptyIcon}>
                        <BellOff color="#414941" size={42} />
                    </View>
                    <Text style={styles.notificationsEmptyTitle}>Nenhuma notificacao por enquanto</Text>
                    <Text style={styles.notificationsEmptyText}>Avisos sobre notas, salas, materiais e prazos vao aparecer aqui.</Text>
                </View>
            </View>

            <View style={styles.notificationsSection}>
                <Text style={styles.notificationsSectionLabel}>Anteriores</Text>
                <View style={styles.notificationsHintCard}>
                    <View style={styles.notificationsHintIcon}>
                        <Info color="#003215" size={22} />
                    </View>
                    <View style={styles.notificationsHintText}>
                        <Text style={styles.notificationsHintTitle}>Historico vazio</Text>
                        <Text style={styles.notificationsHintDescription}>Quando houver notificacoes antigas, elas ficarao agrupadas nesta area.</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}





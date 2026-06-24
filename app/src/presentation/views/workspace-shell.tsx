import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, BookOpen, Calendar, ChartColumn, ClipboardList, GraduationCap, IdCard, Landmark, LayoutDashboard, User } from 'lucide-react-native';
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
    const desktopNav = (
        <View style={[styles.desktopNav, layout.isDesktop ? styles.desktopFloatingNav : null, layout.isDesktop ? { maxWidth: layout.contentMaxWidth } : null]}>
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = workspace.activeTab === tab.id;
                return (
                    <Pressable key={tab.id} onPress={() => workspace.openTab(tab.id)} style={[styles.desktopNavItem, active ? styles.desktopNavItemActive : null]}>
                        <Icon color={active ? colors.inverseText : colors.textMuted} size={18} />
                        <Text numberOfLines={1} style={[styles.desktopNavText, active ? styles.desktopNavTextActive : null]}>{tab.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
            <LinearGradient colors={gradients.app} style={StyleSheet.absoluteFill} />
            <View style={[styles.appShell, layout.isDesktop ? styles.appShellDesktop : null]}>
                <View style={styles.headerShell}>
                    <View style={styles.header}>
                        <View style={styles.headerIdentity}>
                            <GraduationCap color={colors.brandDark} size={26} />
                            <Text numberOfLines={1} style={styles.headerBrandTitle}>Meu Campus</Text>
                        </View>

                        <View style={styles.headerActions}>
                            <Pressable onPress={() => void activeTab.action()} style={styles.headerNotificationButton}>
                                <Bell color={colors.textMuted} size={22} />
                            </Pressable>
                        </View>
                    </View>

                    {layout.isTablet && !layout.isDesktop ? desktopNav : null}
                </View>

                {layout.isTablet ? (
                    <ScrollView
                        contentContainerStyle={[styles.content, { paddingBottom: 112, paddingHorizontal: layout.pagePadding }]}
                        refreshControl={<RefreshControl refreshing={workspace.isLoading} onRefresh={() => void activeTab.action()} tintColor={colors.brand} />}
                        showsVerticalScrollIndicator={Platform.OS === 'web' && !layout.isMobileWeb}
                        style={Platform.OS === 'web' ? styles.webFreeScroll : styles.flexScroll}
                    >
                        <View style={[styles.contentShell, { maxWidth: layout.contentMaxWidth }]}>
                            {workspace.error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{workspace.error}</Text></View> : null}
                            {workspace.activeTab === 'home' ? <DashboardPage workspace={workspace} /> : null}
                            {workspace.activeTab === 'profile' ? <ProfilePage profile={workspace.profile} onRefresh={workspace.loadProfile} onLogout={workspace.logout} loading={workspace.isLoading} /> : null}
                            {workspace.activeTab === 'schedule' ? <SchedulePage schedule={workspace.schedule} onRefresh={workspace.loadSchedule} loading={workspace.isLoading} /> : null}
                            {workspace.activeTab === 'grades' ? <GradesPage grades={workspace.grades} input={workspace.gradesInput} loading={workspace.isLoading} onChange={workspace.setGradesInput} onRefresh={workspace.loadGrades} /> : null}
                            {workspace.activeTab === 'lessonPlan' ? <LessonPlanPage currentGradesInput={workspace.currentGradesInput} grades={workspace.grades} gradesInput={workspace.gradesInput} items={workspace.lessonPlan} loading={workspace.isLoading} onChangeGradesInput={workspace.changeGradesInputAndLoad} onChangeSubjectCode={workspace.changeLessonPlanSubject} onRefresh={workspace.loadLessonPlan} onRefreshSubjects={workspace.loadLessonPlanSubjects} profile={workspace.profile} selectedSubjectCode={workspace.selectedLessonPlanSubjectCode} subjects={workspace.lessonPlanSubjects} /> : null}
                        </View>
                    </ScrollView>
                ) : (
                    <ScrollView
                        contentContainerStyle={[styles.content, { paddingBottom: 112, paddingHorizontal: layout.pagePadding }]}
                        refreshControl={<RefreshControl refreshing={workspace.isLoading} onRefresh={() => void activeTab.action()} tintColor={colors.brand} />}
                        showsVerticalScrollIndicator={Platform.OS === 'web' && !layout.isMobileWeb}
                        style={Platform.OS === 'web' ? styles.webFreeScroll : styles.flexScroll}
                    >
                        <View style={[styles.contentShell, { maxWidth: layout.contentMaxWidth }]}>
                            {workspace.error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{workspace.error}</Text></View> : null}
                            {workspace.activeTab === 'home' ? <DashboardPage workspace={workspace} /> : null}
                            {workspace.activeTab === 'profile' ? <ProfilePage profile={workspace.profile} onRefresh={workspace.loadProfile} onLogout={workspace.logout} loading={workspace.isLoading} /> : null}
                            {workspace.activeTab === 'schedule' ? <SchedulePage schedule={workspace.schedule} onRefresh={workspace.loadSchedule} loading={workspace.isLoading} /> : null}
                            {workspace.activeTab === 'grades' ? <GradesPage grades={workspace.grades} input={workspace.gradesInput} loading={workspace.isLoading} onChange={workspace.setGradesInput} onRefresh={workspace.loadGrades} /> : null}
                            {workspace.activeTab === 'lessonPlan' ? <LessonPlanPage currentGradesInput={workspace.currentGradesInput} grades={workspace.grades} gradesInput={workspace.gradesInput} items={workspace.lessonPlan} loading={workspace.isLoading} onChangeGradesInput={workspace.changeGradesInputAndLoad} onChangeSubjectCode={workspace.changeLessonPlanSubject} onRefresh={workspace.loadLessonPlan} onRefreshSubjects={workspace.loadLessonPlanSubjects} profile={workspace.profile} selectedSubjectCode={workspace.selectedLessonPlanSubjectCode} subjects={workspace.lessonPlanSubjects} /> : null}
                        </View>
                    </ScrollView>
                )}

                {layout.isDesktop ? (
                    <View style={[styles.desktopBottomNavShell, { bottom: 20, left: layout.pagePadding, right: layout.pagePadding }]}>
                        {desktopNav}
                    </View>
                ) : null}

                {layout.showBottomNav ? (
                    <View style={styles.bottomNavShell}>
                        <View style={styles.bottomNav}>
                            {bottomTabs.map((tab) => {
                                const Icon = tab.icon;
                                const active = workspace.activeTab === tab.id;
                                return (
                                    <Pressable key={tab.id} onPress={() => workspace.openTab(tab.id)} style={[styles.navItem, active ? styles.navItemActive : null]}>
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





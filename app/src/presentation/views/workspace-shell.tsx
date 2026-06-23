import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, ChartColumn, ClipboardList, IdCard, Landmark, LogOut, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients } from '@/presentation/design-system';
import type { Workspace } from '@/presentation/views/workspace.types';
import { BootPage } from '@/presentation/views/pages/boot';
import { DashboardPage } from '@/presentation/views/pages/home';
import { GradesPage } from '@/presentation/views/pages/grades';
import { LessonPlanPage } from '@/presentation/views/pages/lesson-plan';
import { LoginPage } from '@/presentation/views/pages/login';
import { ProfilePage } from '@/presentation/views/pages/profile';
import { SchedulePage } from '@/presentation/views/pages/schedule';
import { getInitials, useResponsiveLayout } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function WorkspaceShell({ workspace }: { workspace: Workspace }) {
    const layout = useResponsiveLayout();
    const insets = useSafeAreaInsets();

    if (!workspace.isReady) return <BootPage />;
    if (!workspace.isAuthenticated) return <LoginPage workspace={workspace} />;

    const tabs = [
        { id: 'home' as const, label: 'Inicio', icon: Landmark, action: workspace.refreshDashboard },
        { id: 'profile' as const, label: 'Perfil', icon: IdCard, action: workspace.loadProfile },
        { id: 'schedule' as const, label: 'Horario', icon: Calendar, action: workspace.loadSchedule },
        { id: 'grades' as const, label: 'Notas', icon: ChartColumn, action: workspace.loadGrades },
        { id: 'lessonPlan' as const, label: 'Plano', icon: ClipboardList, action: workspace.loadLessonPlanSubjects }
    ];
    const activeTab = tabs.find((tab) => tab.id === workspace.activeTab) || tabs[0]!;
    const displayName = workspace.profile?.personal.full_name || 'Meu Campus';

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
            <LinearGradient colors={gradients.app} style={StyleSheet.absoluteFill} />
            <View style={[styles.appShell, layout.isDesktop ? styles.appShellDesktop : null]}>
                <View style={[styles.headerShell, { maxWidth: layout.contentMaxWidth, paddingHorizontal: layout.pagePadding }]}>
                    <View style={styles.header}>
                        <View style={styles.headerIdentity}>
                            <View style={styles.avatarBadge}>
                                <Text style={styles.avatarBadgeText}>{getInitials(displayName)}</Text>
                            </View>
                            <View style={styles.headerTextStack}>
                                <Text style={styles.eyebrow}>Meu Campus</Text>
                                <Text numberOfLines={1} style={styles.headerTitle}>{activeTab.label}</Text>
                                <Text numberOfLines={1} style={styles.headerSubtitle}>{displayName}</Text>
                            </View>
                        </View>

                        <View style={styles.headerActions}>
                            <Pressable onPress={() => void activeTab.action()} style={styles.iconButton}>
                                <RefreshCw color={colors.brand} size={18} />
                            </Pressable>
                            <Pressable onPress={() => void workspace.logout()} style={styles.iconButton}>
                                <LogOut color={colors.text} size={18} />
                            </Pressable>
                        </View>
                    </View>

                    {layout.isTablet ? (
                        <View style={styles.desktopNav}>
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
                    ) : null}
                </View>

                {layout.isTablet ? (
                    <ScrollView
                        contentContainerStyle={[styles.content, { paddingBottom: 40, paddingHorizontal: layout.pagePadding }]}
                        refreshControl={<RefreshControl refreshing={workspace.isLoading} onRefresh={() => void activeTab.action()} tintColor={colors.brand} />}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[styles.contentShell, { maxWidth: layout.contentMaxWidth }]}>
                            {workspace.error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{workspace.error}</Text></View> : null}
                            {workspace.activeTab === 'home' ? <DashboardPage workspace={workspace} /> : null}
                            {workspace.activeTab === 'profile' ? <ProfilePage profile={workspace.profile} onRefresh={workspace.loadProfile} loading={workspace.isLoading} /> : null}
                            {workspace.activeTab === 'schedule' ? <SchedulePage schedule={workspace.schedule} onRefresh={workspace.loadSchedule} loading={workspace.isLoading} /> : null}
                            {workspace.activeTab === 'grades' ? <GradesPage grades={workspace.grades} input={workspace.gradesInput} loading={workspace.isLoading} onChange={workspace.setGradesInput} onRefresh={workspace.loadGrades} /> : null}
                            {workspace.activeTab === 'lessonPlan' ? <LessonPlanPage items={workspace.lessonPlan} loading={workspace.isLoading} onChangeSubjectCode={workspace.changeLessonPlanSubject} onRefresh={workspace.loadLessonPlan} onRefreshSubjects={workspace.loadLessonPlanSubjects} selectedSubjectCode={workspace.selectedLessonPlanSubjectCode} subjects={workspace.lessonPlanSubjects} /> : null}
                        </View>
                    </ScrollView>
                ) : (
                    <View style={[styles.content, { paddingBottom: 112 + insets.bottom, paddingHorizontal: layout.pagePadding }]}>
                        <View style={[styles.contentShell, { maxWidth: layout.contentMaxWidth }]}>
                            {workspace.error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{workspace.error}</Text></View> : null}
                            {workspace.activeTab === 'home' ? <DashboardPage workspace={workspace} /> : null}
                            {workspace.activeTab === 'profile' ? <ProfilePage profile={workspace.profile} onRefresh={workspace.loadProfile} loading={workspace.isLoading} /> : null}
                            {workspace.activeTab === 'schedule' ? <SchedulePage schedule={workspace.schedule} onRefresh={workspace.loadSchedule} loading={workspace.isLoading} /> : null}
                            {workspace.activeTab === 'grades' ? <GradesPage grades={workspace.grades} input={workspace.gradesInput} loading={workspace.isLoading} onChange={workspace.setGradesInput} onRefresh={workspace.loadGrades} /> : null}
                            {workspace.activeTab === 'lessonPlan' ? <LessonPlanPage items={workspace.lessonPlan} loading={workspace.isLoading} onChangeSubjectCode={workspace.changeLessonPlanSubject} onRefresh={workspace.loadLessonPlan} onRefreshSubjects={workspace.loadLessonPlanSubjects} selectedSubjectCode={workspace.selectedLessonPlanSubjectCode} subjects={workspace.lessonPlanSubjects} /> : null}
                        </View>
                    </View>
                )}

                {layout.showBottomNav ? (
                    <View style={[styles.bottomNavShell, { bottom: 12 + insets.bottom, left: layout.pagePadding, right: layout.pagePadding }]}>
                        <View style={styles.bottomNav}>
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const active = workspace.activeTab === tab.id;
                                return (
                                    <Pressable key={tab.id} onPress={() => workspace.openTab(tab.id)} style={[styles.navItem, active ? styles.navItemActive : null]}>
                                        <Icon color={active ? colors.brand : colors.textMuted} size={20} />
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

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Calendar,
    ChartColumn,
    Clock3,
    ClipboardList,
    Eye,
    EyeOff,
    IdCard,
    KeyRound,
    Landmark,
    LockKeyhole,
    LogOut,
    Mail,
    Phone,
    RefreshCw
} from 'lucide-react-native';
import { colors, fonts, gradients, radii, shadows, spacing, typography } from '@/presentation/design-system';
import { useEcampusWorkspace } from '@/presentation/hooks/use-ecampus-workspace';

type Workspace = ReturnType<typeof useEcampusWorkspace>;
type ResponsiveLayout = ReturnType<typeof getResponsiveLayout>;

export function EcampusWorkspace() {
    const workspace = useEcampusWorkspace();
    const didRestoreSession = useRef(false);
    const layout = useResponsiveLayout();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (didRestoreSession.current) return;
        didRestoreSession.current = true;
        void workspace.restoreSession();
    }, [workspace]);

    if (!workspace.isReady) {
        return <BootScreen />;
    }

    if (!workspace.isAuthenticated) {
        return <LoginScreen workspace={workspace} />;
    }

    const tabs = [
        { id: 'home' as const, label: 'Inicio', icon: Landmark, action: workspace.refreshDashboard },
        { id: 'profile' as const, label: 'Perfil', icon: IdCard, action: workspace.loadProfile },
        { id: 'schedule' as const, label: 'Horario', icon: Calendar, action: workspace.loadSchedule },
        { id: 'grades' as const, label: 'Notas', icon: ChartColumn, action: workspace.loadGrades },
        { id: 'lessonPlan' as const, label: 'Plano', icon: ClipboardList, action: workspace.loadLessonPlanSubjects }
    ];
    const activeTab = tabs.find((tab) => tab.id === workspace.activeTab) || tabs[0]!;
    const ActiveIcon = activeTab.icon;
    const displayName = workspace.profile?.personal.full_name || 'Painel academico';

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
                                <Text style={styles.eyebrow}>UFAM Academics</Text>
                                <Text numberOfLines={1} style={styles.headerTitle}>{activeTab.label}</Text>
                                <Text numberOfLines={1} style={styles.headerSubtitle}>{displayName}</Text>
                            </View>
                        </View>

                        <Pressable onPress={() => void workspace.logout()} style={styles.iconButton}>
                            <LogOut color={colors.text} size={18} />
                        </Pressable>
                    </View>

                    {layout.isTablet ? (
                        <View style={styles.desktopNav}>
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const active = workspace.activeTab === tab.id;

                                return (
                                    <Pressable
                                        key={tab.id}
                                        onPress={() => workspace.openTab(tab.id)}
                                        style={[styles.desktopNavItem, active ? styles.desktopNavItemActive : null]}
                                    >
                                        <Icon color={active ? colors.inverseText : colors.textMuted} size={18} />
                                        <Text numberOfLines={1} style={[styles.desktopNavText, active ? styles.desktopNavTextActive : null]}>{tab.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    ) : null}
                </View>

                <ScrollView
                    contentContainerStyle={[
                        styles.content,
                        {
                            paddingBottom: layout.showBottomNav ? 112 + insets.bottom : 40,
                            paddingHorizontal: layout.pagePadding
                        }
                    ]}
                    refreshControl={<RefreshControl refreshing={workspace.isLoading} onRefresh={() => void activeTab.action()} tintColor={colors.brand} />}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.contentShell, { maxWidth: layout.contentMaxWidth }]}>
                        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.heroCard, layout.isTablet ? styles.heroCardWide : null]}>
                            <View style={styles.heroContent}>
                                <View style={styles.heroTopRow}>
                                    <View style={styles.heroLabel}>
                                        <ActiveIcon color={colors.brandMuted} size={18} />
                                        <Text style={styles.heroLabelText}>{activeTab.label}</Text>
                                    </View>
                                    <Pressable onPress={() => void activeTab.action()} style={styles.heroRefresh}>
                                        <RefreshCw color={colors.inverseText} size={16} />
                                        <Text style={styles.heroRefreshText}>Atualizar</Text>
                                    </Pressable>
                                </View>
                                <Text numberOfLines={3} style={styles.heroTitle}>{workspace.profile?.academic.course || 'eCampus'}</Text>
                                <Text style={styles.heroSubtitle}>
                                    {workspace.profile?.academic.enrollment_number
                                        ? `Matricula ${workspace.profile.academic.enrollment_number}`
                                        : 'Acompanhe suas informacoes academicas em um painel objetivo.'}
                                </Text>
                            </View>

                            <View style={[styles.heroMetaGrid, layout.isTablet ? styles.heroMetaGridWide : null]}>
                                <HeroMetaCard label="Aluno" value={workspace.profile?.personal.full_name || 'Sessao ativa'} />
                                <HeroMetaCard label="Periodo" value={workspace.gradesInput.year && workspace.gradesInput.period ? `${workspace.gradesInput.year}.${workspace.gradesInput.period}` : 'Atual'} />
                                <HeroMetaCard label="Visao" value={activeTab.label} />
                            </View>
                        </LinearGradient>

                        {workspace.error ? (
                            <View style={styles.errorBanner}>
                                <Text style={styles.errorText}>{workspace.error}</Text>
                            </View>
                        ) : null}

                        {workspace.activeTab === 'home' ? <DashboardPanel workspace={workspace} /> : null}
                        {workspace.activeTab === 'profile' ? <ProfilePanel profile={workspace.profile} onRefresh={workspace.loadProfile} loading={workspace.isLoading} /> : null}
                        {workspace.activeTab === 'schedule' ? <SchedulePanel schedule={workspace.schedule} onRefresh={workspace.loadSchedule} loading={workspace.isLoading} /> : null}
                        {workspace.activeTab === 'grades' ? (
                            <GradesPanel
                                grades={workspace.grades}
                                input={workspace.gradesInput}
                                loading={workspace.isLoading}
                                onChange={workspace.setGradesInput}
                                onRefresh={workspace.loadGrades}
                            />
                        ) : null}
                        {workspace.activeTab === 'lessonPlan' ? (
                            <LessonPlanPanel
                                items={workspace.lessonPlan}
                                loading={workspace.isLoading}
                                onChangeSubjectCode={workspace.changeLessonPlanSubject}
                                onRefresh={workspace.loadLessonPlan}
                                onRefreshSubjects={workspace.loadLessonPlanSubjects}
                                selectedSubjectCode={workspace.selectedLessonPlanSubjectCode}
                                subjects={workspace.lessonPlanSubjects}
                            />
                        ) : null}
                    </View>
                </ScrollView>

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

function BootScreen() {
    const layout = useResponsiveLayout();

    return (
        <SafeAreaView style={styles.bootScreen}>
            <LinearGradient colors={gradients.brand} style={[styles.bootCard, { maxWidth: layout.isTablet ? 560 : 420 }]}>
                <LockKeyhole color={colors.brandMuted} size={28} />
                <Text style={styles.bootTitle}>UFAM Academics</Text>
                            <Text style={styles.bootText}>Carregando dados academicos...</Text>
                <ActivityIndicator color={colors.brandMuted} />
            </LinearGradient>
        </SafeAreaView>
    );
}

function LoginScreen({ workspace }: { workspace: Workspace }) {
    const [user, setUser] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const layout = useResponsiveLayout();
    const insets = useSafeAreaInsets();

    return (
        <SafeAreaView style={styles.loginScreen}>
            <LinearGradient colors={gradients.app} style={StyleSheet.absoluteFill} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.loginContainer}>
                <ScrollView
                    contentContainerStyle={[
                        styles.loginScrollContent,
                        {
                            paddingBottom: Math.max(20, insets.bottom + 20),
                            paddingHorizontal: layout.pagePadding,
                            paddingTop: Math.max(20, insets.top + 20)
                        }
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.loginCard, layout.isTablet ? styles.loginCardWide : null, { maxWidth: layout.loginMaxWidth }]}>
                        <LinearGradient colors={gradients.brand} style={[styles.loginShowcase, layout.isTablet ? styles.loginShowcaseWide : null]}>
                            <View style={styles.loginMark}>
                                <LockKeyhole color={colors.brandMuted} size={32} />
                            </View>
                            <View style={styles.loginHeaderText}>
                                <Text style={styles.eyebrow}>Acesso eCampus</Text>
                                <Text style={styles.loginTitle}>UFAM Academics</Text>
                                <Text style={styles.loginSubtitle}>Acesse suas informacoes academicas com seguranca.</Text>
                            </View>

                            <View style={styles.loginTrustCard}>
                                <Text style={styles.loginFeatureLabel}>Privacidade e seguranca</Text>
                                <Text style={styles.loginFeatureValue}>Sua senha nao fica salva. Ela e usada apenas para autenticar no eCampus.</Text>
                            </View>
                        </LinearGradient>

                        <View style={[styles.loginForm, layout.isTablet ? styles.loginFormWide : null]}>
                            <View style={styles.loginFormHeader}>
                                <Text style={styles.loginFormTitle}>Entrar</Text>
                                <Text style={styles.loginFormText}>Use sua conta institucional para acessar o painel.</Text>
                            </View>

                            <Field label="CPF">
                                <TextInput
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    inputMode="numeric"
                                    maxLength={14}
                                    onChangeText={(value) => setUser(formatCpf(value))}
                                    placeholder="000.000.000-00"
                                    placeholderTextColor={colors.textSubtle}
                                    style={styles.textInput}
                                    value={user}
                                />
                            </Field>

                            <Field label="Senha">
                                <View style={styles.passwordWrapper}>
                                    <TextInput
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        onChangeText={setPassword}
                                        placeholder="Sua senha"
                                        placeholderTextColor={colors.textSubtle}
                                        secureTextEntry={!showPassword}
                                        style={[styles.textInput, styles.passwordInput]}
                                        value={password}
                                    />
                                    <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.passwordToggle}>
                                        {showPassword ? <EyeOff color={colors.textMuted} size={18} /> : <Eye color={colors.textMuted} size={18} />}
                                    </Pressable>
                                </View>
                            </Field>

                            {workspace.error ? (
                                <View style={styles.errorBanner}>
                                    <Text style={styles.errorText}>{workspace.error}</Text>
                                </View>
                            ) : null}

                            <Pressable
                                disabled={workspace.isLoading}
                                onPress={() => void workspace.login({ password, user: onlyDigits(user) })}
                                style={styles.primaryButton}
                            >
                                {workspace.isLoading ? <ActivityIndicator color={colors.inverseText} /> : <KeyRound color={colors.inverseText} size={18} />}
                                <Text style={styles.primaryButtonText}>{workspace.isLoading ? 'Entrando...' : 'Entrar'}</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function DashboardPanel({ workspace }: { workspace: Workspace }) {
    const layout = useResponsiveLayout();
    const { grades, isLoading, lessonPlanSubjects, profile, schedule } = workspace;
    const groupedSchedule = useMemo(() => groupScheduleByDay(schedule), [schedule]);
    const weekMap = useMemo(() => buildWeekMap(groupedSchedule), [groupedSchedule]);
    const nextClass = useMemo(() => getNextScheduleClass(schedule), [schedule]);
    const numericGrades = grades.map((grade) => parseGrade(grade.final_grade)).filter((grade): grade is number => grade !== null);
    const averageNumber = numericGrades.length ? numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length : null;
    const approved = grades.filter((grade) => isApprovedStatus(grade.status)).length;
    const totalAbsences = grades.reduce((sum, grade) => sum + parseAbsences(grade.absences), 0);
    const activityCount = grades.reduce((sum, grade) => sum + grade.evaluations.length, 0);
    const subjectCount = Math.max(lessonPlanSubjects.length, grades.length, new Set(schedule.map((item) => item.code)).size);
    const chartMax = Math.max(...weekMap.map((day) => day.items.length), 1);
    const weakestGrades = grades
        .map((grade) => ({ grade, parsedFinal: parseGrade(grade.final_grade) }))
        .filter((entry): entry is { grade: Workspace['grades'][number]; parsedFinal: number } => entry.parsedFinal !== null)
        .sort((a, b) => a.parsedFinal - b.parsedFinal)
        .slice(0, 3);

    if (isLoading && !profile && schedule.length === 0 && grades.length === 0) {
        return <DashboardSkeleton />;
    }

    return (
        <View style={styles.sectionStack}>
            <LinearGradient colors={gradients.surface} style={styles.panel}>
                <View style={[styles.homeHeroRow, layout.isTablet ? styles.homeHeroRowWide : null]}>
                    <View style={styles.homeHeroText}>
                        <Text style={styles.sectionKicker}>Resumo academico</Text>
                        <Text style={styles.panelTitle}>{profile?.personal.full_name || 'Carregando dados'}</Text>
                        <Text style={styles.panelDescription}>{profile?.academic.course || 'Seu painel aparece aqui assim que os dados chegarem.'}</Text>
                    </View>
                    <View style={styles.homeScoreCard}>
                        <Text style={styles.homeScoreLabel}>Media</Text>
                        <Text style={styles.homeScoreValue}>{averageNumber === null ? '-' : averageNumber.toFixed(1)}</Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={[styles.metricGrid, layout.isTablet ? styles.metricGridWide : null]}>
                <MetricCard label="Materias" value={String(subjectCount)} />
                <MetricCard label="Aulas" value={String(schedule.length)} />
                <MetricCard label="Atividades" value={String(activityCount)} />
                <MetricCard label="Faltas" value={String(totalAbsences)} />
            </View>

            <View style={[styles.twoColumnGrid, layout.isTablet ? styles.twoColumnGridWide : null]}>
                <View style={[styles.panel, layout.isTablet ? styles.gridPanel : null]}>
                    <PanelHeader loading={isLoading} onRefresh={workspace.refreshDashboard} title={nextClass?.isHappening ? 'Aula acontecendo' : 'Proxima aula'} />
                    <View style={styles.highlightCard}>
                        <Text style={styles.highlightLabel}>{nextClass?.label || 'Horario'}</Text>
                        <Text style={styles.highlightTitle}>{nextClass?.item.subject || 'Nenhuma aula carregada'}</Text>
                        <Text style={styles.highlightText}>
                            {nextClass ? `${nextClass.item.start_time} ate ${nextClass.item.end_time}` : 'Atualize para buscar seu horario semanal.'}
                        </Text>
                        <Text style={styles.highlightTime}>{nextClass?.item.start_time || '--:--'}</Text>
                    </View>
                </View>

                <View style={[styles.panel, layout.isTablet ? styles.gridPanel : null]}>
                    <PanelHeader loading={isLoading} onRefresh={workspace.loadSchedule} title="Semana" />
                    <View style={styles.weekChart}>
                        {weekMap.map((day) => (
                            <View key={day.weekday} style={styles.weekBarItem}>
                                <View style={styles.weekBarTrack}>
                                    <View style={[styles.weekBarFill, { height: Math.max(10, (day.items.length / chartMax) * 88) }]} />
                                </View>
                                <Text style={styles.weekBarLabel}>{day.short}</Text>
                                <Text style={styles.weekBarValue}>{day.items.length}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>

            <View style={[styles.twoColumnGrid, layout.isTablet ? styles.twoColumnGridWide : null]}>
                <View style={[styles.panel, layout.isTablet ? styles.gridPanel : null]}>
                    <PanelHeader loading={isLoading} onRefresh={workspace.loadGrades} title="Notas" />
                    <View style={styles.gradeSummaryBoard}>
                        <View style={styles.gradeRing}>
                            <Text style={styles.gradeRingValue}>{averageNumber === null ? '-' : averageNumber.toFixed(1)}</Text>
                            <Text style={styles.gradeRingLabel}>geral</Text>
                        </View>
                        <View style={styles.gradeStatStack}>
                            <StatPill label="Aprovadas" value={String(approved)} />
                            <StatPill label="Em atencao" value={String(grades.length - approved)} />
                            <StatPill label="Lancadas" value={String(grades.length)} />
                        </View>
                    </View>
                </View>

                <View style={[styles.panel, layout.isTablet ? styles.gridPanel : null]}>
                    <PanelHeader loading={isLoading} onRefresh={workspace.loadGrades} title="Pontos de atencao" />
                    <View style={styles.listStack}>
                        {weakestGrades.length === 0 ? <EmptyInline text="Nenhuma nota carregada." /> : null}
                        {weakestGrades.map(({ grade }) => (
                            <View key={`${grade.code}-${grade.subject}`} style={styles.attentionCard}>
                                <Text style={styles.smallCaps}>{grade.code}</Text>
                                <Text style={styles.attentionTitle}>{grade.subject}</Text>
                                <Text style={styles.attentionText}>MF {grade.final_grade || '-'}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}

function ProfilePanel({
    loading,
    onRefresh,
    profile
}: {
    loading: boolean;
    onRefresh: () => Promise<void>;
    profile: Workspace['profile'];
}) {
    const layout = useResponsiveLayout();
    if (loading && !profile) return <ProfileSkeleton />;
    if (!profile) return <EmptyState label="Carregar perfil" loading={loading} onRefresh={onRefresh} />;

    const contactRows = [
        { icon: Mail, label: 'Email', value: profile.contact.email },
        { icon: Phone, label: 'Telefone', value: profile.contact.cellphone || profile.contact.home_phone }
    ];
    const rows = [
        ['Matricula', profile.academic.enrollment_number],
        ['Curso', profile.academic.course],
        ['Turno', profile.academic.shift],
        ['Ingresso', profile.academic.admission_term],
        ['Nascimento', profile.personal.birth_date],
        ['Mae', profile.personal.mother_name]
    ];

    return (
        <View style={styles.sectionStack}>
            <LinearGradient colors={gradients.surface} style={styles.profileHero}>
                <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{getInitials(profile.personal.full_name)}</Text>
                </View>
                <View style={styles.profileHeroText}>
                    <Text style={styles.sectionKicker}>Aluno</Text>
                    <Text style={styles.panelTitle}>{profile.personal.full_name || '-'}</Text>
                    <Text style={styles.panelDescription}>{profile.academic.course || '-'}</Text>
                </View>
            </LinearGradient>

            <View style={[styles.metricGrid, layout.isTablet ? styles.metricGridWide : null]}>
                {contactRows.map((row) => {
                    const Icon = row.icon;

                    return (
                        <View key={row.label} style={[styles.infoTile, getResponsiveCardStyle(layout, 2)]}>
                            <Icon color={colors.brand} size={18} />
                            <Text style={styles.tileLabel}>{row.label}</Text>
                            <Text style={styles.tileValue}>{row.value || '-'}</Text>
                        </View>
                    );
                })}
            </View>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefresh} title="Dados academicos" />
                <View style={[styles.detailsGrid, layout.isTablet ? styles.metricGridWide : null]}>
                    {rows.map(([label, value]) => (
                        <View key={label} style={[styles.detailCard, getResponsiveCardStyle(layout, 3)]}>
                            <Text style={styles.tileLabel}>{label}</Text>
                            <Text style={styles.detailValue}>{value || '-'}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

function SchedulePanel({
    loading,
    onRefresh,
    schedule
}: {
    loading: boolean;
    onRefresh: () => Promise<void>;
    schedule: Workspace['schedule'];
}) {
    const layout = useResponsiveLayout();
    const groupedSchedule = useMemo(() => groupScheduleByDay(schedule), [schedule]);
    const weekMap = useMemo(() => buildWeekMap(groupedSchedule), [groupedSchedule]);
    const busiestDay = weekMap.reduce((current, day) => (day.items.length > current.items.length ? day : current), weekMap[0]!);
    const nextClass = useMemo(() => getNextScheduleClass(schedule), [schedule]);

    if (loading && schedule.length === 0) return <ScheduleSkeleton />;

    return (
        <View style={styles.sectionStack}>
            <View style={[styles.metricGrid, layout.isTablet ? styles.metricGridWide : null]}>
                <MetricCard label="Aulas" value={String(schedule.length)} />
                <MetricCard label="Dias" value={String(groupedSchedule.length)} />
                <MetricCard label="Pico" value={busiestDay.items.length ? busiestDay.short : '-'} />
            </View>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefresh} title={nextClass?.isHappening ? 'Aula agora' : 'Proxima aula'} />
                <View style={styles.scheduleHero}>
                    <View style={styles.scheduleHeroText}>
                        <Text style={styles.panelTitle}>{nextClass?.item.subject || 'Sem horario carregado'}</Text>
                        <Text style={styles.panelDescription}>
                            {nextClass
                                ? `${nextClass.label} - ${nextClass.item.start_time} ate ${nextClass.item.end_time}`
                                : 'Atualize para montar seu horario semanal.'}
                        </Text>
                    </View>
                    <View style={styles.timeBadge}>
                        <Clock3 color={colors.info} size={18} />
                        <Text style={styles.timeBadgeText}>{nextClass?.item.start_time || '--:--'}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefresh} title="Horario semanal" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                    {weekMap.map((day) => (
                        <View key={day.weekday} style={[styles.weekChip, day.items.length ? styles.weekChipActive : null]}>
                            <Text style={[styles.weekChipText, day.items.length ? styles.weekChipTextActive : null]}>{day.short}</Text>
                            <Text style={[styles.weekChipNumber, day.items.length ? styles.weekChipTextActive : null]}>{day.items.length}</Text>
                        </View>
                    ))}
                </ScrollView>
                <View style={styles.listStack}>
                    {schedule.length === 0 ? <EmptyInline text="Nenhuma aula carregada." /> : null}
                    {weekMap.filter((day) => day.items.length > 0).map((group) => (
                        <View key={group.weekday} style={styles.laneCard}>
                            <View style={styles.laneHeader}>
                                <Text style={styles.panelTitle}>{group.label}</Text>
                                <Text style={styles.panelDescription}>{group.items.length} aula{group.items.length === 1 ? '' : 's'}</Text>
                            </View>
                            {group.items.map((item, index) => (
                                <View key={`${item.weekday}-${item.start_time}-${item.class_identifier}`} style={[styles.scheduleEvent, eventTone(index)]}>
                                    <View style={styles.eventTimeBox}>
                                        <Text style={styles.eventTimePrimary}>{item.start_time}</Text>
                                        <Text style={styles.eventTimeSecondary}>{item.end_time}</Text>
                                    </View>
                                    <View style={styles.eventBody}>
                                        <Text style={styles.smallCaps}>{item.code}</Text>
                                        <Text style={styles.eventTitle}>{item.subject}</Text>
                                        <Text style={styles.eventSubtitle}>{item.class_identifier}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

function GradesPanel({
    grades,
    input,
    loading,
    onChange,
    onRefresh
}: {
    grades: Workspace['grades'];
    input: Workspace['gradesInput'];
    loading: boolean;
    onChange: Workspace['setGradesInput'];
    onRefresh: () => Promise<void>;
}) {
    const layout = useResponsiveLayout();
    if (loading && grades.length === 0) return <GradesSkeleton />;

    const numericGrades = grades.map((grade) => parseGrade(grade.final_grade)).filter((grade): grade is number => grade !== null);
    const averageNumber = numericGrades.length ? numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length : null;
    const approved = grades.filter((grade) => isApprovedStatus(grade.status)).length;
    const totalAbsences = grades.reduce((sum, grade) => sum + parseAbsences(grade.absences), 0);
    const pending = grades.length - approved;

    return (
        <View style={styles.sectionStack}>
            <LinearGradient colors={gradients.surface} style={styles.panel}>
                <Text style={styles.sectionKicker}>Boletim do periodo</Text>
                <Text style={styles.bigNumber}>{averageNumber === null ? '-' : averageNumber.toFixed(1)}</Text>
                <Text style={styles.panelDescription}>Media geral</Text>
                <View style={[styles.gradeOverviewGrid, layout.isTablet ? styles.metricGridWide : null]}>
                    <StatPill label="Materias" value={String(grades.length)} />
                    <StatPill label="Aprovadas" value={String(approved)} />
                    <StatPill label="Em aberto" value={String(pending)} />
                    <StatPill label="Faltas" value={String(totalAbsences)} />
                </View>
            </LinearGradient>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={() => onRefresh()} title="Notas e frequencia" />
                <View style={[styles.inputRow, layout.isTablet ? styles.inputRowWide : null]}>
                    <Field compact label="Ano">
                        <TextInput
                            inputMode="numeric"
                            onChangeText={(value) => onChange({ ...input, year: value })}
                            placeholder="2026"
                            placeholderTextColor={colors.textSubtle}
                            style={styles.textInput}
                            value={input.year}
                        />
                    </Field>
                    <Field compact label="Periodo">
                        <TextInput
                            inputMode="numeric"
                            onChangeText={(value) => onChange({ ...input, period: value })}
                            placeholder="1"
                            placeholderTextColor={colors.textSubtle}
                            style={styles.textInput}
                            value={input.period}
                        />
                    </Field>
                    <Pressable onPress={() => void onRefresh()} style={styles.iconButton}>
                        <RefreshCw color={colors.text} size={18} />
                    </Pressable>
                </View>

                <View style={styles.listStack}>
                    {grades.length === 0 ? <EmptyInline text="Nenhuma nota carregada." /> : null}
                    {grades.map((grade) => (
                        <View key={`${grade.code}-${grade.subject}`} style={styles.gradeCard}>
                            <View style={styles.gradeHeader}>
                                <View style={styles.gradeHeaderText}>
                                    <Text style={styles.smallCaps}>
                                        {grade.code}{grade.class_identifier ? ` - ${grade.class_identifier}` : ''}
                                    </Text>
                                    <Text style={styles.eventTitle}>{grade.subject}</Text>
                                </View>
                                <View style={[styles.statusPill, gradeToneStyle(grade.status)]}>
                                    <Text style={styles.statusPillText}>{grade.status || '-'}</Text>
                                </View>
                            </View>

                            {grade.evaluations.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
                                    {grade.evaluations.map((evaluation, index) => (
                                        <View key={`${grade.code}-${index}`} style={styles.evaluationCard}>
                                            <View style={styles.evaluationBadge}>
                                                <Text style={styles.evaluationBadgeText}>{index + 1}</Text>
                                            </View>
                                            <Text style={styles.smallCaps}>Atividade {index + 1}</Text>
                                            <Text style={styles.evaluationScore}>{evaluation.score || '-'}</Text>
                                            <Text style={styles.panelDescription}>Peso {evaluation.weight || '-'}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <EmptyInline text="Sem atividades lancadas." />
                            )}

                            <View style={[styles.metricGrid, layout.isTablet ? styles.metricGridWide : null]}>
                                <MiniGrade label="ME" value={grade.exercise_average || '-'} helper="Exercicios" />
                                <MiniGrade label="PF" value={grade.final_exam || '-'} helper="Prova final" />
                                <MiniGrade featured label="MF" value={grade.final_grade || '-'} helper="Media final" />
                                <MiniGrade label="FT" value={grade.absences || '-'} helper="Faltas" />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

function LessonPlanPanel({
    items,
    loading,
    onChangeSubjectCode,
    onRefresh,
    onRefreshSubjects,
    selectedSubjectCode,
    subjects
}: {
    items: Workspace['lessonPlan'];
    loading: boolean;
    onChangeSubjectCode: (value: string) => void;
    onRefresh: () => Promise<void>;
    onRefreshSubjects: () => Promise<void>;
    selectedSubjectCode: string;
    subjects: Workspace['lessonPlanSubjects'];
}) {
    const layout = useResponsiveLayout();
    const selectedSubject = subjects.find((subject) => subject.code === selectedSubjectCode) || null;
    const availableSubjects = subjects.filter((subject) => subject.available).length;

    if (loading && subjects.length === 0 && items.length === 0) return <LessonPlanSkeleton />;

    return (
        <View style={styles.sectionStack}>
            <View style={[styles.metricGrid, layout.isTablet ? styles.metricGridWide : null]}>
                <MetricCard label="Materias" value={String(subjects.length)} />
                <MetricCard label="Com plano" value={String(availableSubjects)} />
                <MetricCard label="Aulas" value={String(items.length)} />
            </View>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefreshSubjects} title="Plano de ensino" />
                <View style={styles.listStack}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
                        {subjects.map((subject) => {
                            const active = subject.code === selectedSubjectCode;

                            return (
                                <Pressable
                                    key={`${subject.code}-${subject.classIdentifier}`}
                                    onPress={() => onChangeSubjectCode(subject.code)}
                                    style={[styles.subjectChip, active ? styles.subjectChipActive : null]}
                                >
                                    <Text style={[styles.subjectChipCode, active ? styles.subjectChipCodeActive : null]}>{subject.code}</Text>
                                    <Text numberOfLines={1} style={[styles.subjectChipText, active ? styles.subjectChipTextActive : null]}>
                                        {subject.subject}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    <Pressable onPress={() => void onRefresh()} style={styles.secondaryButton}>
                        <RefreshCw color={colors.brand} size={16} />
                        <Text style={styles.secondaryButtonText}>Buscar plano</Text>
                    </Pressable>

                    {selectedSubject ? (
                        <View style={styles.selectedSubjectCard}>
                            <View style={[styles.statusPill, selectedSubject.available ? styles.statusOk : styles.statusWarn]}>
                                <Text style={styles.statusPillText}>{selectedSubject.available ? 'Disponivel' : 'Indisponivel'}</Text>
                            </View>
                            <Text style={styles.eventTitle}>{selectedSubject.subject}</Text>
                            <Text style={styles.panelDescription}>{selectedSubject.code} - {selectedSubject.classIdentifier || 'Turma nao informada'}</Text>
                            <Text style={styles.panelDescription}>{selectedSubject.professor || 'Docente nao informado'}</Text>
                        </View>
                    ) : null}

                    {items.length === 0 ? <EmptyInline text="Nenhum item carregado." /> : null}
                    {items.map((item, index) => (
                        <View key={`${item.date}-${item.content}-${index}`} style={styles.lessonCard}>
                            <View style={styles.lessonDateBox}>
                                <Text style={styles.lessonDate}>{item.date || '-'}</Text>
                                <Text style={styles.lessonWorkload}>{formatWorkload(item.workload)}</Text>
                            </View>
                            <View style={styles.lessonBody}>
                                <Text style={styles.smallCaps}>{item.type || 'Aula'}</Text>
                                <Text style={styles.eventTitle}>{item.content || '-'}</Text>
                                <Text style={styles.panelDescription}>{item.professor || '-'}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

function PanelHeader({ loading, onRefresh, title }: { loading: boolean; onRefresh: () => Promise<void>; title: string }) {
    return (
        <View style={styles.panelHeader}>
            <Text numberOfLines={2} style={styles.panelTitle}>{title}</Text>
            <Pressable onPress={() => void onRefresh()} style={styles.iconButton}>
                {loading ? <ActivityIndicator color={colors.text} size="small" /> : <RefreshCw color={colors.text} size={18} />}
            </Pressable>
        </View>
    );
}

function Field({
    children,
    compact = false,
    label
}: {
    children: ReactNode;
    compact?: boolean;
    label: string;
}) {
    return (
        <View style={[styles.field, compact ? styles.fieldCompact : null]}>
            <Text style={styles.fieldLabel}>{label}</Text>
            {children}
        </View>
    );
}

function MetricCard({ label, value }: { label: string; value: string }) {
    const layout = useResponsiveLayout();

    return (
        <View style={[styles.metricCard, getResponsiveCardStyle(layout, 4)]}>
            <Text numberOfLines={1} style={styles.tileLabel}>{label}</Text>
            <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
        </View>
    );
}

function MiniGrade({
    featured = false,
    helper,
    label,
    value
}: {
    featured?: boolean;
    helper: string;
    label: string;
    value: string;
}) {
    const layout = useResponsiveLayout();

    return (
        <View style={[styles.miniGradeCard, getResponsiveCardStyle(layout, 4), featured ? styles.miniGradeCardFeatured : null]}>
            <Text style={styles.smallCaps}>{label}</Text>
            <Text style={[styles.miniGradeValue, featured ? styles.miniGradeValueFeatured : null]}>{value}</Text>
            <Text style={styles.panelDescription}>{helper}</Text>
        </View>
    );
}

function StatPill({ label, value }: { label: string; value: string }) {
    const layout = useResponsiveLayout();

    return (
        <View style={[styles.statPill, getResponsiveCardStyle(layout, 4)]}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.statPillValue}>{value}</Text>
        </View>
    );
}

function HeroMetaCard({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.heroMetaCard}>
            <Text style={styles.heroMetaLabel}>{label}</Text>
            <Text numberOfLines={2} style={styles.heroMetaValue}>{value}</Text>
        </View>
    );
}

function EmptyState({ label, loading, onRefresh }: { label: string; loading: boolean; onRefresh: () => Promise<void> }) {
    return (
        <View style={styles.panel}>
            <Pressable disabled={loading} onPress={() => void onRefresh()} style={styles.primaryButton}>
                {loading ? <ActivityIndicator color={colors.inverseText} /> : <RefreshCw color={colors.inverseText} size={18} />}
                <Text style={styles.primaryButtonText}>{loading ? 'Carregando...' : label}</Text>
            </Pressable>
        </View>
    );
}

function EmptyInline({ text }: { text: string }) {
    return (
        <View style={styles.emptyInline}>
            <Text style={styles.emptyInlineText}>{text}</Text>
        </View>
    );
}

function DashboardSkeleton() {
    return (
        <View style={styles.sectionStack}>
            <SkeletonBlock height={150} />
            <View style={styles.metricGrid}>
                <SkeletonBlock height={92} />
                <SkeletonBlock height={92} />
                <SkeletonBlock height={92} />
                <SkeletonBlock height={92} />
            </View>
            <View style={styles.twoColumnGrid}>
                <SkeletonBlock height={220} />
                <SkeletonBlock height={220} />
            </View>
        </View>
    );
}

function ProfileSkeleton() {
    return (
        <View style={styles.sectionStack}>
            <SkeletonBlock height={136} />
            <View style={styles.metricGrid}>
                <SkeletonBlock height={92} />
                <SkeletonBlock height={92} />
            </View>
            <SkeletonBlock height={260} />
        </View>
    );
}

function ScheduleSkeleton() {
    return (
        <View style={styles.sectionStack}>
            <View style={styles.metricGrid}>
                <SkeletonBlock height={92} />
                <SkeletonBlock height={92} />
                <SkeletonBlock height={92} />
            </View>
            <SkeletonBlock height={140} />
            <SkeletonBlock height={320} />
        </View>
    );
}

function GradesSkeleton() {
    return (
        <View style={styles.sectionStack}>
            <SkeletonBlock height={184} />
            <SkeletonBlock height={360} />
        </View>
    );
}

function LessonPlanSkeleton() {
    return (
        <View style={styles.sectionStack}>
            <View style={styles.metricGrid}>
                <SkeletonBlock height={92} />
                <SkeletonBlock height={92} />
                <SkeletonBlock height={92} />
            </View>
            <SkeletonBlock height={360} />
        </View>
    );
}

function SkeletonBlock({ height }: { height: number }) {
    return <View style={[styles.skeletonBlock, { height }]} />;
}

function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return `${words[0]?.[0] || 'U'}${words[1]?.[0] || 'A'}`.toUpperCase();
}

function onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
}

function formatCpf(value: string): string {
    const digits = onlyDigits(value).slice(0, 11);
    const firstPart = digits.slice(0, 3);
    const secondPart = digits.slice(3, 6);
    const thirdPart = digits.slice(6, 9);
    const verifier = digits.slice(9, 11);

    if (digits.length > 9) return `${firstPart}.${secondPart}.${thirdPart}-${verifier}`;
    if (digits.length > 6) return `${firstPart}.${secondPart}.${thirdPart}`;
    if (digits.length > 3) return `${firstPart}.${secondPart}`;
    return firstPart;
}

function groupScheduleByDay(schedule: Workspace['schedule']) {
    const groups = new Map<string, Workspace['schedule']>();

    for (const item of schedule) {
        groups.set(item.weekday, [...(groups.get(item.weekday) || []), item]);
    }

    return Array.from(groups.entries()).map(([weekday, items]) => ({ weekday, items }));
}

function buildWeekMap(groupedSchedule: Array<{ weekday: string; items: Workspace['schedule'] }>) {
    const weekdays = [
        { weekday: 'Monday', label: 'Segunda', short: 'Seg' },
        { weekday: 'Tuesday', label: 'Terca', short: 'Ter' },
        { weekday: 'Wednesday', label: 'Quarta', short: 'Qua' },
        { weekday: 'Thursday', label: 'Quinta', short: 'Qui' },
        { weekday: 'Friday', label: 'Sexta', short: 'Sex' },
        { weekday: 'Saturday', label: 'Sabado', short: 'Sab' },
        { weekday: 'Sunday', label: 'Domingo', short: 'Dom' }
    ];

    return weekdays.map((day) => ({
        ...day,
        items: groupedSchedule.find((group) => group.weekday === day.weekday)?.items || []
    }));
}

function getNextScheduleClass(schedule: Workspace['schedule']) {
    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const candidates = schedule
        .map((item) => {
            const dayIndex = getWeekdayIndex(item.weekday);
            if (dayIndex === null) return null;

            const startMinutes = parseTimeToMinutes(item.start_time);
            const endMinutes = parseTimeToMinutes(item.end_time);
            if (startMinutes === null || endMinutes === null) return null;

            const isToday = dayIndex === currentDay;
            const isHappening = isToday && currentMinutes >= startMinutes && currentMinutes < endMinutes;
            let daysUntil = (dayIndex - currentDay + 7) % 7;

            if (isToday && currentMinutes >= endMinutes) {
                daysUntil = 7;
            }

            const nextDate = new Date(now);
            nextDate.setDate(now.getDate() + daysUntil);
            nextDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

            return {
                item,
                isHappening,
                label: translateWeekday(item.weekday),
                timestamp: isHappening ? now.getTime() : nextDate.getTime()
            };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
        .sort((a, b) => a.timestamp - b.timestamp);

    return candidates[0] || null;
}

function getWeekdayIndex(weekday: string): number | null {
    const map: Record<string, number> = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6
    };

    return map[weekday] ?? null;
}

function parseTimeToMinutes(value: string): number | null {
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    return hours * 60 + minutes;
}

function translateWeekday(weekday: string): string {
    const map: Record<string, string> = {
        Monday: 'Segunda',
        Tuesday: 'Terca',
        Wednesday: 'Quarta',
        Thursday: 'Quinta',
        Friday: 'Sexta',
        Saturday: 'Sabado',
        Sunday: 'Domingo'
    };

    return map[weekday] || weekday;
}

function parseGrade(value: string): number | null {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseAbsences(value: string): number {
    const parsed = Number(value.replace(/\D/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function isApprovedStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return normalized.includes('aprov') || normalized === 'ap';
}

function formatWorkload(workload: string | number): string {
    if (typeof workload === 'number') return `${workload}h`;
    if (!workload) return '-';
    return workload.endsWith('h') ? workload : `${workload}h`;
}

function useResponsiveLayout() {
    const { width } = useWindowDimensions();
    return getResponsiveLayout(width);
}

function getResponsiveLayout(width: number) {
    const safeWidth = Number.isFinite(width) ? width : 390;
    const isTablet = safeWidth >= 768;
    const isDesktop = Platform.OS === 'web' && safeWidth >= 1180;
    const isCompactPhone = safeWidth < 380;
    const pagePadding = isDesktop ? 24 : isCompactPhone ? 12 : 18;

    return {
        width: safeWidth,
        isTablet,
        isDesktop,
        isCompactPhone,
        pagePadding,
        showBottomNav: !isTablet,
        contentMaxWidth: isDesktop ? 1180 : isTablet ? 960 : 640,
        loginMaxWidth: isDesktop ? 1040 : isTablet ? 920 : 460
    };
}

function getResponsiveCardStyle(layout: ResponsiveLayout, columns: number) {
    if (!layout.isTablet) {
        return {
            flexBasis: columns >= 4 ? '47%' : '100%'
        } as const;
    }

    if (columns === 2) {
        return {
            flexBasis: '48%'
        } as const;
    }

    if (columns === 3) {
        return {
            flexBasis: layout.isDesktop ? '31.5%' : '48%'
        } as const;
    }

    return {
        flexBasis: layout.isDesktop ? '23.4%' : '31.5%'
    } as const;
}

function eventTone(index: number) {
    const tones = [styles.eventToneGreen, styles.eventToneBlue, styles.eventToneAmber, styles.eventToneCoral];
    return tones[index % tones.length];
}

function gradeToneStyle(status: string) {
    const normalized = status.toLowerCase();
    if (normalized.includes('aprov')) return styles.statusOk;
    if (normalized.includes('reprov')) return styles.statusDanger;
    return styles.statusWarn;
}

const styles = StyleSheet.create({
    screen: {
        flex: 1
    },
    appShell: {
        flex: 1
    },
    appShellDesktop: {
        paddingHorizontal: 24
    },
    bootScreen: {
        alignItems: 'center',
        backgroundColor: colors.canvas,
        flex: 1,
        justifyContent: 'center',
        padding: spacing[6]
    },
    bootCard: {
        alignItems: 'center',
        borderRadius: radii.md,
        gap: spacing[3],
        paddingHorizontal: spacing[7],
        paddingVertical: spacing[8],
        width: '100%'
    },
    bootTitle: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 24,
        fontWeight: '700'
    },
    bootText: {
        color: colors.brandMuted,
        fontFamily: fonts.sans,
        fontSize: 15,
        textAlign: 'center'
    },
    loginScreen: {
        flex: 1
    },
    loginContainer: {
        flex: 1
    },
    loginScrollContent: {
        alignItems: 'center',
        flexGrow: 1,
        justifyContent: 'center',
        width: '100%'
    },
    loginCard: {
        ...shadows.surface,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        overflow: 'hidden',
        width: '100%'
    },
    loginCardWide: {
        flexDirection: 'row'
    },
    loginShowcase: {
        gap: spacing[6],
        padding: spacing[7]
    },
    loginShowcaseWide: {
        justifyContent: 'space-between',
        maxWidth: 420,
        minHeight: 520,
        width: '46%'
    },
    loginMark: {
        alignItems: 'center',
        backgroundColor: colors.overlayOnBrand,
        borderRadius: radii.md,
        height: 64,
        justifyContent: 'center',
        width: 64
    },
    loginHeaderText: {
        gap: spacing[2]
    },
    eyebrow: {
        ...typography.eyebrow,
        color: colors.brandMuted,
        textTransform: 'uppercase'
    },
    loginTitle: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 30,
        fontWeight: '700'
    },
    loginSubtitle: {
        color: colors.brandMuted,
        fontFamily: fonts.sans,
        fontSize: 15,
        lineHeight: 22
    },
    loginForm: {
        gap: spacing[5],
        padding: spacing[6]
    },
    loginFormWide: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing[8],
        paddingVertical: spacing[7]
    },
    loginFormHeader: {
        gap: spacing[2]
    },
    loginFormTitle: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 28,
        fontWeight: '700'
    },
    loginFormText: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 14,
        lineHeight: 20
    },
    loginTrustCard: {
        backgroundColor: colors.overlayOnBrand,
        borderColor: colors.overlayBorderOnBrand,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[3],
        padding: spacing[4]
    },
    loginFeatureLabel: {
        ...typography.label,
        color: colors.brandMuted,
        textTransform: 'uppercase'
    },
    loginFeatureValue: {
        color: colors.inverseText,
        fontFamily: fonts.sans,
        fontSize: 14,
        lineHeight: 20
    },
    field: {
        gap: spacing[2]
    },
    fieldCompact: {
        flex: 1,
        minWidth: 0
    },
    fieldLabel: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
    },
    textInput: {
        backgroundColor: colors.surfaceSubtle,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        color: colors.text,
        fontFamily: fonts.sans,
        fontSize: 16,
        minHeight: 52,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3]
    },
    passwordWrapper: {
        position: 'relative'
    },
    passwordInput: {
        paddingRight: 54
    },
    passwordToggle: {
        alignItems: 'center',
        height: 52,
        justifyContent: 'center',
        position: 'absolute',
        right: 0,
        top: 0,
        width: 52
    },
    primaryButton: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        minHeight: 54,
        paddingHorizontal: spacing[5]
    },
    primaryButtonText: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 16,
        fontWeight: '700'
    },
    headerShell: {
        alignSelf: 'center',
        gap: spacing[3],
        paddingHorizontal: spacing[5],
        paddingTop: spacing[3],
        width: '100%'
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 4
    },
    headerIdentity: {
        alignItems: 'center',
        flexDirection: 'row',
        flex: 1,
        gap: spacing[3],
        minWidth: 0
    },
    avatarBadge: {
        alignItems: 'center',
        backgroundColor: colors.brandMuted,
        borderRadius: radii.md,
        height: 48,
        justifyContent: 'center',
        width: 48
    },
    avatarBadgeText: {
        color: colors.brand,
        fontFamily: fonts.medium,
        fontSize: 18,
        fontWeight: '700'
    },
    headerTextStack: {
        flex: 1,
        gap: 2
    },
    headerTitle: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 18,
        fontWeight: '700'
    },
    headerSubtitle: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 13
    },
    iconButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        height: 42,
        justifyContent: 'center',
        width: 42
    },
    desktopNav: {
        alignSelf: 'stretch',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: 'row',
        flexWrap: 'nowrap',
        gap: spacing[2],
        padding: spacing[2]
    },
    desktopNavItem: {
        alignItems: 'center',
        borderRadius: radii.sm,
        flex: 1,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        minHeight: 46,
        paddingHorizontal: spacing[3]
    },
    desktopNavItemActive: {
        backgroundColor: colors.brandDark
    },
    desktopNavText: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 14,
        fontWeight: '700'
    },
    desktopNavTextActive: {
        color: colors.inverseText
    },
    content: {
        gap: spacing[4],
        paddingHorizontal: spacing[5],
        paddingTop: spacing[3]
    },
    contentShell: {
        alignSelf: 'center',
        gap: spacing[4],
        width: '100%'
    },
    heroCard: {
        borderRadius: radii.md,
        gap: spacing[5],
        overflow: 'hidden',
        padding: spacing[6]
    },
    heroCardWide: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    heroContent: {
        flex: 1,
        gap: spacing[3]
    },
    heroTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[3],
        justifyContent: 'space-between'
    },
    heroLabel: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[2]
    },
    heroLabelText: {
        color: colors.brandMuted,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
    },
    heroRefresh: {
        alignItems: 'center',
        backgroundColor: colors.overlayOnBrand,
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2]
    },
    heroRefreshText: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
    },
    heroTitle: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 26,
        fontWeight: '700',
        lineHeight: 32
    },
    heroSubtitle: {
        color: colors.brandMuted,
        fontFamily: fonts.sans,
        fontSize: 14,
        lineHeight: 21
    },
    heroMetaGrid: {
        gap: spacing[2]
    },
    heroMetaGridWide: {
        marginLeft: 20,
        width: 280
    },
    heroMetaCard: {
        backgroundColor: colors.overlayOnBrand,
        borderColor: colors.overlayBorderOnBrand,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[2],
        padding: spacing[3]
    },
    heroMetaLabel: {
        ...typography.label,
        color: colors.brandMuted,
        textTransform: 'uppercase'
    },
    heroMetaValue: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20
    },
    errorBanner: {
        backgroundColor: colors.dangerSubtle,
        borderColor: colors.dangerBorder,
        borderRadius: radii.md,
        borderWidth: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3]
    },
    errorText: {
        color: colors.danger,
        fontFamily: fonts.medium,
        fontSize: 14,
        fontWeight: '600'
    },
    sectionStack: {
        gap: spacing[4]
    },
    panel: {
        ...shadows.surface,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[4],
        padding: spacing[5]
    },
    panelHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[3],
        justifyContent: 'space-between'
    },
    panelTitle: {
        ...typography.title,
        color: colors.text,
        flexShrink: 1,
    },
    panelDescription: {
        ...typography.body,
        color: colors.textMuted
    },
    sectionKicker: {
        ...typography.eyebrow,
        color: colors.brand,
        textTransform: 'uppercase'
    },
    homeHeroRow: {
        gap: spacing[4]
    },
    homeHeroRowWide: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    homeHeroText: {
        flex: 1,
        gap: spacing[2]
    },
    homeScoreCard: {
        alignItems: 'flex-start',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.md,
        gap: spacing[1],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        width: 140
    },
    homeScoreLabel: {
        ...typography.label,
        color: colors.textMuted,
        textTransform: 'uppercase'
    },
    homeScoreValue: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 34,
        fontWeight: '700'
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[3]
    },
    metricGridWide: {
        justifyContent: 'space-between'
    },
    metricCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        flexBasis: '47%',
        flexGrow: 1,
        gap: spacing[2],
        minHeight: 90,
        padding: spacing[4]
    },
    tileLabel: {
        ...typography.label,
        color: colors.textMuted,
        textTransform: 'uppercase'
    },
    tileValue: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '600'
    },
    metricValue: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 30,
        fontWeight: '700'
    },
    twoColumnGrid: {
        gap: spacing[4]
    },
    twoColumnGridWide: {
        flexDirection: 'row',
        flexWrap: 'wrap'
    },
    gridPanel: {
        flex: 1,
        minWidth: 0
    },
    highlightCard: {
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.md,
        gap: spacing[2],
        padding: spacing[4]
    },
    highlightLabel: {
        ...typography.label,
        color: colors.textMuted,
        textTransform: 'uppercase'
    },
    highlightTitle: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 18,
        fontWeight: '700'
    },
    highlightText: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 14
    },
    highlightTime: {
        color: colors.brand,
        fontFamily: fonts.medium,
        fontSize: 30,
        fontWeight: '700',
        marginTop: spacing[2]
    },
    weekChart: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'space-between',
        minHeight: 140
    },
    weekBarItem: {
        alignItems: 'center',
        flex: 1,
        gap: spacing[2]
    },
    weekBarTrack: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.md,
        flex: 1,
        justifyContent: 'flex-end',
        minHeight: 100,
        overflow: 'hidden',
        padding: spacing[1],
        width: '100%'
    },
    weekBarFill: {
        backgroundColor: colors.brand,
        borderRadius: radii.sm,
        width: '100%'
    },
    weekBarLabel: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 12,
        fontWeight: '700'
    },
    weekBarValue: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
    },
    gradeSummaryBoard: {
        gap: spacing[5]
    },
    gradeRing: {
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: colors.brandSubtle,
        borderColor: colors.brandMuted,
        borderRadius: radii.pill,
        borderWidth: 12,
        height: 150,
        justifyContent: 'center',
        width: 150
    },
    gradeRingValue: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 34,
        fontWeight: '700'
    },
    gradeRingLabel: {
        ...typography.label,
        color: colors.textMuted,
        textTransform: 'uppercase'
    },
    gradeStatStack: {
        gap: spacing[2]
    },
    statPill: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.md,
        gap: spacing[1],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3]
    },
    statPillValue: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 20,
        fontWeight: '700'
    },
    listStack: {
        gap: spacing[3]
    },
    attentionCard: {
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radii.md,
        gap: spacing[1],
        padding: spacing[3]
    },
    attentionTitle: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 16,
        fontWeight: '700'
    },
    attentionText: {
        color: colors.brand,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '600'
    },
    profileHero: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[4],
        padding: spacing[5]
    },
    profileAvatar: {
        alignItems: 'center',
        backgroundColor: colors.brandMuted,
        borderRadius: radii.md,
        height: 68,
        justifyContent: 'center',
        width: 68
    },
    profileAvatarText: {
        color: colors.brand,
        fontFamily: fonts.medium,
        fontSize: 24,
        fontWeight: '700'
    },
    profileHeroText: {
        flex: 1,
        gap: spacing[2],
        minWidth: 0
    },
    infoTile: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        flexBasis: '47%',
        flexGrow: 1,
        gap: spacing[2],
        minHeight: 90,
        padding: spacing[4]
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[3]
    },
    detailCard: {
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radii.md,
        flexBasis: '47%',
        flexGrow: 1,
        gap: spacing[2],
        minHeight: 90,
        padding: spacing[4]
    },
    detailValue: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '600'
    },
    scheduleHero: {
        gap: spacing[4]
    },
    scheduleHeroText: {
        gap: spacing[2]
    },
    timeBadge: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.infoSubtle,
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    timeBadgeText: {
        color: colors.info,
        fontFamily: fonts.medium,
        fontSize: 18,
        fontWeight: '700'
    },
    chipsRow: {
        marginBottom: spacing[2]
    },
    weekChip: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing[2],
        marginRight: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    weekChipActive: {
        backgroundColor: colors.brandMuted
    },
    weekChipText: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 12,
        fontWeight: '700'
    },
    weekChipTextActive: {
        color: colors.brand
    },
    weekChipNumber: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
    },
    laneCard: {
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radii.md,
        gap: spacing[3],
        padding: spacing[4]
    },
    laneHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing[3],
        justifyContent: 'space-between'
    },
    scheduleEvent: {
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing[3],
        padding: spacing[3]
    },
    eventToneGreen: {
        backgroundColor: colors.successSubtle
    },
    eventToneBlue: {
        backgroundColor: colors.infoSubtle
    },
    eventToneAmber: {
        backgroundColor: colors.warningSubtle
    },
    eventToneCoral: {
        backgroundColor: colors.dangerSubtle
    },
    eventTimeBox: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        justifyContent: 'center',
        minHeight: 64,
        paddingHorizontal: spacing[3],
        width: 88
    },
    eventTimePrimary: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 18,
        fontWeight: '700'
    },
    eventTimeSecondary: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 12
    },
    eventBody: {
        flex: 1,
        gap: spacing[1],
        minWidth: 0
    },
    smallCaps: {
        ...typography.label,
        color: colors.textMuted,
        textTransform: 'uppercase'
    },
    eventTitle: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 21
    },
    eventSubtitle: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 13
    },
    bigNumber: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 48,
        fontWeight: '700'
    },
    gradeOverviewGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2]
    },
    inputRow: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        gap: spacing[2]
    },
    inputRowWide: {
        alignItems: 'stretch'
    },
    gradeCard: {
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radii.md,
        gap: spacing[4],
        padding: spacing[4]
    },
    gradeHeader: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: spacing[3],
        justifyContent: 'space-between'
    },
    gradeHeaderText: {
        flex: 1,
        gap: spacing[1],
        minWidth: 0
    },
    statusPill: {
        borderRadius: radii.pill,
        flexShrink: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    statusOk: {
        backgroundColor: colors.successSubtle
    },
    statusWarn: {
        backgroundColor: colors.warningSubtle
    },
    statusDanger: {
        backgroundColor: colors.dangerSubtle
    },
    statusPillText: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 12,
        fontWeight: '700'
    },
    horizontalList: {
        marginHorizontal: -2
    },
    evaluationCard: {
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        gap: spacing[2],
        marginRight: spacing[2],
        padding: spacing[4],
        width: 138
    },
    evaluationBadge: {
        alignItems: 'center',
        backgroundColor: colors.brandMuted,
        borderRadius: radii.sm,
        height: 28,
        justifyContent: 'center',
        width: 28
    },
    evaluationBadgeText: {
        color: colors.brand,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
    },
    evaluationScore: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 26,
        fontWeight: '700'
    },
    miniGradeCard: {
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        flexBasis: '47%',
        flexGrow: 1,
        gap: spacing[2],
        padding: spacing[4]
    },
    miniGradeCardFeatured: {
        backgroundColor: colors.brandMuted
    },
    miniGradeValue: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 24,
        fontWeight: '700'
    },
    miniGradeValueFeatured: {
        color: colors.brand
    },
    subjectChip: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.md,
        gap: spacing[1],
        marginRight: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3],
        width: 176
    },
    subjectChipActive: {
        backgroundColor: colors.brandDark
    },
    subjectChipCode: {
        ...typography.label,
        color: colors.textMuted,
        textTransform: 'uppercase'
    },
    subjectChipCodeActive: {
        color: colors.brandMuted
    },
    subjectChipText: {
        color: colors.text,
        fontFamily: fonts.medium,
        fontSize: 14,
        fontWeight: '600'
    },
    subjectChipTextActive: {
        color: colors.inverseText
    },
    secondaryButton: {
        alignItems: 'center',
        borderColor: colors.borderStrong,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: spacing[4]
    },
    secondaryButtonText: {
        color: colors.brand,
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '700'
    },
    selectedSubjectCard: {
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.md,
        gap: spacing[2],
        padding: spacing[4]
    },
    lessonCard: {
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radii.md,
        gap: spacing[3],
        padding: spacing[4]
    },
    lessonDateBox: {
        alignItems: 'flex-start',
        backgroundColor: colors.infoSubtle,
        borderRadius: radii.md,
        gap: spacing[1],
        padding: spacing[3]
    },
    lessonDate: {
        color: colors.info,
        fontFamily: fonts.medium,
        fontSize: 14,
        fontWeight: '700'
    },
    lessonWorkload: {
        color: colors.info,
        fontFamily: fonts.medium,
        fontSize: 12,
        fontWeight: '700'
    },
    lessonBody: {
        gap: 4
    },
    emptyInline: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.md,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[4]
    },
    emptyInlineText: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 14,
        textAlign: 'center'
    },
    bottomNav: {
        ...shadows.surface,
        alignSelf: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        maxWidth: 560,
        paddingBottom: Platform.OS === 'ios' ? 18 : 14,
        paddingHorizontal: spacing[2],
        paddingTop: spacing[2],
        width: '100%'
    },
    bottomNavShell: {
        position: 'absolute',
        zIndex: 10
    },
    navItem: {
        alignItems: 'center',
        borderRadius: radii.sm,
        flex: 1,
        gap: spacing[1],
        paddingVertical: spacing[2]
    },
    navItemActive: {
        backgroundColor: colors.brandMuted
    },
    navText: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 11,
        fontWeight: '700'
    },
    navTextActive: {
        color: colors.brand
    },
    skeletonBlock: {
        backgroundColor: colors.border,
        borderRadius: radii.md
    }
});

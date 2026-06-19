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
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    BookOpen,
    CalendarDays,
    Clock3,
    Eye,
    EyeOff,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    Mail,
    Phone,
    RefreshCw,
    ShieldCheck,
    UserRound
} from 'lucide-react-native';
import { useEcampusWorkspace } from '@/presentation/hooks/use-ecampus-workspace';

type Workspace = ReturnType<typeof useEcampusWorkspace>;

export function EcampusWorkspace() {
    const workspace = useEcampusWorkspace();
    const didRestoreSession = useRef(false);

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
        { id: 'home' as const, label: 'Inicio', icon: LayoutDashboard, action: workspace.refreshDashboard },
        { id: 'profile' as const, label: 'Perfil', icon: UserRound, action: workspace.loadProfile },
        { id: 'schedule' as const, label: 'Horario', icon: CalendarDays, action: workspace.loadSchedule },
        { id: 'grades' as const, label: 'Notas', icon: GraduationCap, action: workspace.loadGrades },
        { id: 'lessonPlan' as const, label: 'Plano', icon: BookOpen, action: workspace.loadLessonPlanSubjects }
    ];
    const activeTab = tabs.find((tab) => tab.id === workspace.activeTab) || tabs[0]!;
    const ActiveIcon = activeTab.icon;
    const displayName = workspace.profile?.personal.full_name || 'Painel academico';

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
            <LinearGradient colors={['#f7f1e6', '#eef6f1', '#e5efe8']} style={StyleSheet.absoluteFill} />

            <View style={styles.header}>
                <View style={styles.headerIdentity}>
                    <View style={styles.avatarBadge}>
                        <Text style={styles.avatarBadgeText}>{getInitials(displayName)}</Text>
                    </View>
                    <View style={styles.headerTextStack}>
                        <Text style={styles.eyebrow}>UFAM Academics</Text>
                        <Text style={styles.headerTitle}>{activeTab.label}</Text>
                        <Text numberOfLines={1} style={styles.headerSubtitle}>{displayName}</Text>
                    </View>
                </View>

                <Pressable onPress={() => void workspace.logout()} style={styles.iconButton}>
                    <LogOut color="#16352f" size={18} />
                </Pressable>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={workspace.isLoading} onRefresh={() => void activeTab.action()} tintColor="#0d7b5d" />}
                showsVerticalScrollIndicator={false}
            >
                <LinearGradient colors={['#10372f', '#165548']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
                    <View style={styles.heroTopRow}>
                        <View style={styles.heroLabel}>
                            <ActiveIcon color="#b7ead9" size={18} />
                            <Text style={styles.heroLabelText}>{activeTab.label}</Text>
                        </View>
                        <Pressable onPress={() => void activeTab.action()} style={styles.heroRefresh}>
                            <RefreshCw color="#fff" size={16} />
                            <Text style={styles.heroRefreshText}>Atualizar</Text>
                        </Pressable>
                    </View>
                    <Text style={styles.heroTitle}>{workspace.profile?.academic.course || 'eCampus'}</Text>
                    <Text style={styles.heroSubtitle}>
                        {workspace.profile?.academic.enrollment_number
                            ? `Matricula ${workspace.profile.academic.enrollment_number}`
                            : 'Dados academicos'}
                    </Text>
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
            </ScrollView>

            <View style={styles.bottomNav}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = workspace.activeTab === tab.id;

                    return (
                        <Pressable key={tab.id} onPress={() => workspace.openTab(tab.id)} style={[styles.navItem, active ? styles.navItemActive : null]}>
                            <Icon color={active ? '#0d7b5d' : '#607670'} size={20} />
                            <Text style={[styles.navText, active ? styles.navTextActive : null]}>{tab.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </SafeAreaView>
    );
}

function BootScreen() {
    return (
        <SafeAreaView style={styles.bootScreen}>
            <LinearGradient colors={['#10372f', '#165548']} style={styles.bootCard}>
                <ShieldCheck color="#d6f4e9" size={28} />
                <Text style={styles.bootTitle}>UFAM Academics</Text>
                <Text style={styles.bootText}>Preparando seu espaco academico...</Text>
                <ActivityIndicator color="#d6f4e9" />
            </LinearGradient>
        </SafeAreaView>
    );
}

function LoginScreen({ workspace }: { workspace: Workspace }) {
    const [user, setUser] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    return (
        <SafeAreaView style={styles.loginScreen}>
            <LinearGradient colors={['#f7f1e6', '#eef6f1', '#e5efe8']} style={StyleSheet.absoluteFill} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.loginContainer}>
                <View style={styles.loginCard}>
                    <LinearGradient colors={['#10372f', '#165548']} style={styles.loginHeader}>
                        <View style={styles.loginMark}>
                            <ShieldCheck color="#d6f4e9" size={28} />
                        </View>
                        <View style={styles.loginHeaderText}>
                            <Text style={styles.eyebrow}>Acesso eCampus</Text>
                            <Text style={styles.loginTitle}>UFAM Academics</Text>
                            <Text style={styles.loginSubtitle}>Entre com sua conta institucional</Text>
                        </View>
                    </LinearGradient>

                    <View style={styles.loginForm}>
                        <Field label="CPF">
                            <TextInput
                                autoCapitalize="none"
                                autoCorrect={false}
                                inputMode="numeric"
                                maxLength={14}
                                onChangeText={(value) => setUser(formatCpf(value))}
                                placeholder="000.000.000-00"
                                placeholderTextColor="#7b8b85"
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
                                    placeholderTextColor="#7b8b85"
                                    secureTextEntry={!showPassword}
                                    style={[styles.textInput, styles.passwordInput]}
                                    value={password}
                                />
                                <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.passwordToggle}>
                                    {showPassword ? <EyeOff color="#5e726b" size={18} /> : <Eye color="#5e726b" size={18} />}
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
                            {workspace.isLoading ? <ActivityIndicator color="#fff" /> : <ShieldCheck color="#fff" size={18} />}
                            <Text style={styles.primaryButtonText}>{workspace.isLoading ? 'Entrando...' : 'Entrar'}</Text>
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function DashboardPanel({ workspace }: { workspace: Workspace }) {
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
            <LinearGradient colors={['#ffffff', '#f8fbf8']} style={styles.panel}>
                <View style={styles.homeHeroRow}>
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

            <View style={styles.metricGrid}>
                <MetricCard label="Materias" value={String(subjectCount)} />
                <MetricCard label="Aulas" value={String(schedule.length)} />
                <MetricCard label="Atividades" value={String(activityCount)} />
                <MetricCard label="Faltas" value={String(totalAbsences)} />
            </View>

            <View style={styles.twoColumnGrid}>
                <View style={styles.panel}>
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

                <View style={styles.panel}>
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

            <View style={styles.twoColumnGrid}>
                <View style={styles.panel}>
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

                <View style={styles.panel}>
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
            <LinearGradient colors={['#ffffff', '#f8fbf8']} style={styles.profileHero}>
                <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{getInitials(profile.personal.full_name)}</Text>
                </View>
                <View style={styles.profileHeroText}>
                    <Text style={styles.sectionKicker}>Aluno</Text>
                    <Text style={styles.panelTitle}>{profile.personal.full_name || '-'}</Text>
                    <Text style={styles.panelDescription}>{profile.academic.course || '-'}</Text>
                </View>
            </LinearGradient>

            <View style={styles.metricGrid}>
                {contactRows.map((row) => {
                    const Icon = row.icon;

                    return (
                        <View key={row.label} style={styles.infoTile}>
                            <Icon color="#0d7b5d" size={18} />
                            <Text style={styles.tileLabel}>{row.label}</Text>
                            <Text style={styles.tileValue}>{row.value || '-'}</Text>
                        </View>
                    );
                })}
            </View>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefresh} title="Dados academicos" />
                <View style={styles.detailsGrid}>
                    {rows.map(([label, value]) => (
                        <View key={label} style={styles.detailCard}>
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
    const groupedSchedule = useMemo(() => groupScheduleByDay(schedule), [schedule]);
    const weekMap = useMemo(() => buildWeekMap(groupedSchedule), [groupedSchedule]);
    const busiestDay = weekMap.reduce((current, day) => (day.items.length > current.items.length ? day : current), weekMap[0]!);
    const nextClass = useMemo(() => getNextScheduleClass(schedule), [schedule]);

    if (loading && schedule.length === 0) return <ScheduleSkeleton />;

    return (
        <View style={styles.sectionStack}>
            <View style={styles.metricGrid}>
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
                        <Clock3 color="#245fd9" size={18} />
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
    if (loading && grades.length === 0) return <GradesSkeleton />;

    const numericGrades = grades.map((grade) => parseGrade(grade.final_grade)).filter((grade): grade is number => grade !== null);
    const averageNumber = numericGrades.length ? numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length : null;
    const approved = grades.filter((grade) => isApprovedStatus(grade.status)).length;
    const totalAbsences = grades.reduce((sum, grade) => sum + parseAbsences(grade.absences), 0);
    const pending = grades.length - approved;

    return (
        <View style={styles.sectionStack}>
            <LinearGradient colors={['#ffffff', '#f8fbf8']} style={styles.panel}>
                <Text style={styles.sectionKicker}>Boletim do periodo</Text>
                <Text style={styles.bigNumber}>{averageNumber === null ? '-' : averageNumber.toFixed(1)}</Text>
                <Text style={styles.panelDescription}>Media geral</Text>
                <View style={styles.gradeOverviewGrid}>
                    <StatPill label="Materias" value={String(grades.length)} />
                    <StatPill label="Aprovadas" value={String(approved)} />
                    <StatPill label="Em aberto" value={String(pending)} />
                    <StatPill label="Faltas" value={String(totalAbsences)} />
                </View>
            </LinearGradient>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={() => onRefresh()} title="Notas e frequencia" />
                <View style={styles.inputRow}>
                    <Field compact label="Ano">
                        <TextInput
                            inputMode="numeric"
                            onChangeText={(value) => onChange({ ...input, year: value })}
                            placeholder="2026"
                            placeholderTextColor="#7b8b85"
                            style={styles.textInput}
                            value={input.year}
                        />
                    </Field>
                    <Field compact label="Periodo">
                        <TextInput
                            inputMode="numeric"
                            onChangeText={(value) => onChange({ ...input, period: value })}
                            placeholder="1"
                            placeholderTextColor="#7b8b85"
                            style={styles.textInput}
                            value={input.period}
                        />
                    </Field>
                    <Pressable onPress={() => void onRefresh()} style={styles.iconButton}>
                        <RefreshCw color="#16352f" size={18} />
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
                                        <View key={`${grade.code}-${evaluation.label}`} style={styles.evaluationCard}>
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

                            <View style={styles.metricGrid}>
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
    const selectedSubject = subjects.find((subject) => subject.code === selectedSubjectCode) || null;
    const availableSubjects = subjects.filter((subject) => subject.available).length;

    if (loading && subjects.length === 0 && items.length === 0) return <LessonPlanSkeleton />;

    return (
        <View style={styles.sectionStack}>
            <View style={styles.metricGrid}>
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
                        <RefreshCw color="#0d7b5d" size={16} />
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
            <Text style={styles.panelTitle}>{title}</Text>
            <Pressable onPress={() => void onRefresh()} style={styles.iconButton}>
                {loading ? <ActivityIndicator color="#16352f" size="small" /> : <RefreshCw color="#16352f" size={18} />}
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
    return (
        <View style={styles.metricCard}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.metricValue}>{value}</Text>
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
    return (
        <View style={[styles.miniGradeCard, featured ? styles.miniGradeCardFeatured : null]}>
            <Text style={styles.smallCaps}>{label}</Text>
            <Text style={[styles.miniGradeValue, featured ? styles.miniGradeValueFeatured : null]}>{value}</Text>
            <Text style={styles.panelDescription}>{helper}</Text>
        </View>
    );
}

function StatPill({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.statPill}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.statPillValue}>{value}</Text>
        </View>
    );
}

function EmptyState({ label, loading, onRefresh }: { label: string; loading: boolean; onRefresh: () => Promise<void> }) {
    return (
        <View style={styles.panel}>
            <Pressable disabled={loading} onPress={() => void onRefresh()} style={styles.primaryButton}>
                {loading ? <ActivityIndicator color="#fff" /> : <RefreshCw color="#fff" size={18} />}
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
    bootScreen: {
        alignItems: 'center',
        backgroundColor: '#eef6f1',
        flex: 1,
        justifyContent: 'center',
        padding: 24
    },
    bootCard: {
        alignItems: 'center',
        borderRadius: 28,
        gap: 12,
        paddingHorizontal: 28,
        paddingVertical: 32,
        width: '100%'
    },
    bootTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '700'
    },
    bootText: {
        color: '#d6f4e9',
        fontSize: 15,
        textAlign: 'center'
    },
    loginScreen: {
        flex: 1
    },
    loginContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        padding: 20
    },
    loginCard: {
        backgroundColor: '#ffffff',
        borderColor: '#d7e3dd',
        borderRadius: 28,
        borderWidth: 1,
        overflow: 'hidden',
        width: '100%'
    },
    loginHeader: {
        flexDirection: 'row',
        gap: 16,
        padding: 24
    },
    loginMark: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 18,
        height: 56,
        justifyContent: 'center',
        width: 56
    },
    loginHeaderText: {
        flex: 1,
        gap: 6
    },
    eyebrow: {
        color: '#9bd9c6',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.2,
        textTransform: 'uppercase'
    },
    loginTitle: {
        color: '#ffffff',
        fontSize: 30,
        fontWeight: '700'
    },
    loginSubtitle: {
        color: '#d6f4e9',
        fontSize: 14
    },
    loginForm: {
        gap: 18,
        padding: 20
    },
    field: {
        gap: 8
    },
    fieldCompact: {
        flex: 1
    },
    fieldLabel: {
        color: '#5c6d67',
        fontSize: 13,
        fontWeight: '700'
    },
    textInput: {
        backgroundColor: '#f6faf7',
        borderColor: '#d4e1db',
        borderRadius: 18,
        borderWidth: 1,
        color: '#18322d',
        fontSize: 16,
        minHeight: 52,
        paddingHorizontal: 16,
        paddingVertical: 12
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
        backgroundColor: '#0d7b5d',
        borderRadius: 18,
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'center',
        minHeight: 54,
        paddingHorizontal: 18
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700'
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingTop: 6,
        paddingBottom: 8
    },
    headerIdentity: {
        alignItems: 'center',
        flexDirection: 'row',
        flex: 1,
        gap: 12
    },
    avatarBadge: {
        alignItems: 'center',
        backgroundColor: '#e0f2ea',
        borderRadius: 18,
        height: 48,
        justifyContent: 'center',
        width: 48
    },
    avatarBadgeText: {
        color: '#0d7b5d',
        fontSize: 18,
        fontWeight: '700'
    },
    headerTextStack: {
        flex: 1,
        gap: 2
    },
    headerTitle: {
        color: '#18322d',
        fontSize: 18,
        fontWeight: '700'
    },
    headerSubtitle: {
        color: '#5d7069',
        fontSize: 13
    },
    iconButton: {
        alignItems: 'center',
        backgroundColor: '#eef4f1',
        borderRadius: 16,
        height: 42,
        justifyContent: 'center',
        width: 42
    },
    content: {
        gap: 16,
        paddingBottom: 120,
        paddingHorizontal: 18,
        paddingTop: 8
    },
    heroCard: {
        borderRadius: 28,
        gap: 12,
        padding: 20
    },
    heroTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    heroLabel: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8
    },
    heroLabelText: {
        color: '#b7ead9',
        fontSize: 13,
        fontWeight: '700'
    },
    heroRefresh: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 16,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10
    },
    heroRefreshText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700'
    },
    heroTitle: {
        color: '#ffffff',
        fontSize: 26,
        fontWeight: '700'
    },
    heroSubtitle: {
        color: '#d6f4e9',
        fontSize: 14
    },
    errorBanner: {
        backgroundColor: '#fff1ef',
        borderColor: '#ffcfc7',
        borderRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12
    },
    errorText: {
        color: '#a43c2a',
        fontSize: 14,
        fontWeight: '600'
    },
    sectionStack: {
        gap: 16
    },
    panel: {
        backgroundColor: '#ffffff',
        borderColor: '#d7e3dd',
        borderRadius: 26,
        borderWidth: 1,
        gap: 16,
        padding: 18
    },
    panelHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    panelTitle: {
        color: '#15302b',
        fontSize: 20,
        fontWeight: '700'
    },
    panelDescription: {
        color: '#62756d',
        fontSize: 14,
        lineHeight: 20
    },
    sectionKicker: {
        color: '#0d7b5d',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.1,
        textTransform: 'uppercase'
    },
    homeHeroRow: {
        gap: 14
    },
    homeHeroText: {
        gap: 8
    },
    homeScoreCard: {
        alignItems: 'flex-start',
        backgroundColor: '#f2f8f4',
        borderRadius: 22,
        gap: 4,
        paddingHorizontal: 16,
        paddingVertical: 14,
        width: 140
    },
    homeScoreLabel: {
        color: '#4d615a',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    homeScoreValue: {
        color: '#12352e',
        fontSize: 34,
        fontWeight: '700'
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    metricCard: {
        backgroundColor: '#ffffff',
        borderColor: '#d7e3dd',
        borderRadius: 22,
        borderWidth: 1,
        flexBasis: '47%',
        flexGrow: 1,
        gap: 8,
        minHeight: 90,
        padding: 14
    },
    tileLabel: {
        color: '#62756d',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.7,
        textTransform: 'uppercase'
    },
    tileValue: {
        color: '#15302b',
        fontSize: 15,
        fontWeight: '600'
    },
    metricValue: {
        color: '#12352e',
        fontSize: 30,
        fontWeight: '700'
    },
    twoColumnGrid: {
        gap: 16
    },
    highlightCard: {
        backgroundColor: '#eef7f3',
        borderRadius: 22,
        gap: 8,
        padding: 16
    },
    highlightLabel: {
        color: '#557068',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.7,
        textTransform: 'uppercase'
    },
    highlightTitle: {
        color: '#15302b',
        fontSize: 18,
        fontWeight: '700'
    },
    highlightText: {
        color: '#62756d',
        fontSize: 14
    },
    highlightTime: {
        color: '#0d7b5d',
        fontSize: 30,
        fontWeight: '700',
        marginTop: 8
    },
    weekChart: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'space-between',
        minHeight: 140
    },
    weekBarItem: {
        alignItems: 'center',
        flex: 1,
        gap: 8
    },
    weekBarTrack: {
        alignItems: 'center',
        backgroundColor: '#f1f5f2',
        borderRadius: 16,
        flex: 1,
        justifyContent: 'flex-end',
        minHeight: 100,
        overflow: 'hidden',
        padding: 6,
        width: '100%'
    },
    weekBarFill: {
        backgroundColor: '#0d7b5d',
        borderRadius: 12,
        width: '100%'
    },
    weekBarLabel: {
        color: '#62756d',
        fontSize: 12,
        fontWeight: '700'
    },
    weekBarValue: {
        color: '#15302b',
        fontSize: 13,
        fontWeight: '700'
    },
    gradeSummaryBoard: {
        gap: 18
    },
    gradeRing: {
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: '#eff8f4',
        borderColor: '#cfe3db',
        borderRadius: 999,
        borderWidth: 12,
        height: 150,
        justifyContent: 'center',
        width: 150
    },
    gradeRingValue: {
        color: '#12352e',
        fontSize: 34,
        fontWeight: '700'
    },
    gradeRingLabel: {
        color: '#62756d',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.7,
        textTransform: 'uppercase'
    },
    gradeStatStack: {
        gap: 10
    },
    statPill: {
        backgroundColor: '#f3f7f5',
        borderRadius: 18,
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 12
    },
    statPillValue: {
        color: '#15302b',
        fontSize: 20,
        fontWeight: '700'
    },
    listStack: {
        gap: 12
    },
    attentionCard: {
        backgroundColor: '#f7faf8',
        borderRadius: 20,
        gap: 4,
        padding: 14
    },
    attentionTitle: {
        color: '#15302b',
        fontSize: 16,
        fontWeight: '700'
    },
    attentionText: {
        color: '#0d7b5d',
        fontSize: 13,
        fontWeight: '600'
    },
    profileHero: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 16,
        padding: 18
    },
    profileAvatar: {
        alignItems: 'center',
        backgroundColor: '#e0f2ea',
        borderRadius: 22,
        height: 68,
        justifyContent: 'center',
        width: 68
    },
    profileAvatarText: {
        color: '#0d7b5d',
        fontSize: 24,
        fontWeight: '700'
    },
    profileHeroText: {
        flex: 1,
        gap: 6
    },
    infoTile: {
        backgroundColor: '#ffffff',
        borderColor: '#d7e3dd',
        borderRadius: 22,
        borderWidth: 1,
        flexBasis: '47%',
        flexGrow: 1,
        gap: 8,
        minHeight: 90,
        padding: 14
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    detailCard: {
        backgroundColor: '#f6faf7',
        borderRadius: 20,
        flexBasis: '47%',
        flexGrow: 1,
        gap: 8,
        minHeight: 90,
        padding: 14
    },
    detailValue: {
        color: '#15302b',
        fontSize: 15,
        fontWeight: '600'
    },
    scheduleHero: {
        gap: 14
    },
    scheduleHeroText: {
        gap: 8
    },
    timeBadge: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#ebf3ff',
        borderRadius: 18,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10
    },
    timeBadgeText: {
        color: '#245fd9',
        fontSize: 18,
        fontWeight: '700'
    },
    chipsRow: {
        marginBottom: 8
    },
    weekChip: {
        alignItems: 'center',
        backgroundColor: '#f3f7f5',
        borderRadius: 999,
        flexDirection: 'row',
        gap: 8,
        marginRight: 10,
        paddingHorizontal: 14,
        paddingVertical: 10
    },
    weekChipActive: {
        backgroundColor: '#dff3eb'
    },
    weekChipText: {
        color: '#62756d',
        fontSize: 12,
        fontWeight: '700'
    },
    weekChipTextActive: {
        color: '#0d7b5d'
    },
    weekChipNumber: {
        color: '#15302b',
        fontSize: 13,
        fontWeight: '700'
    },
    laneCard: {
        backgroundColor: '#f8fbf9',
        borderRadius: 22,
        gap: 12,
        padding: 14
    },
    laneHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    scheduleEvent: {
        borderRadius: 20,
        flexDirection: 'row',
        gap: 12,
        padding: 12
    },
    eventToneGreen: {
        backgroundColor: '#f0f8f4'
    },
    eventToneBlue: {
        backgroundColor: '#eef3ff'
    },
    eventToneAmber: {
        backgroundColor: '#fff7e8'
    },
    eventToneCoral: {
        backgroundColor: '#fff0ed'
    },
    eventTimeBox: {
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 18,
        justifyContent: 'center',
        minHeight: 64,
        paddingHorizontal: 12,
        width: 88
    },
    eventTimePrimary: {
        color: '#15302b',
        fontSize: 18,
        fontWeight: '700'
    },
    eventTimeSecondary: {
        color: '#62756d',
        fontSize: 12
    },
    eventBody: {
        flex: 1,
        gap: 4
    },
    smallCaps: {
        color: '#607670',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.7,
        textTransform: 'uppercase'
    },
    eventTitle: {
        color: '#15302b',
        fontSize: 16,
        fontWeight: '700'
    },
    eventSubtitle: {
        color: '#62756d',
        fontSize: 13
    },
    bigNumber: {
        color: '#15302b',
        fontSize: 48,
        fontWeight: '700'
    },
    gradeOverviewGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    inputRow: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        gap: 10
    },
    gradeCard: {
        backgroundColor: '#f8fbf9',
        borderRadius: 22,
        gap: 14,
        padding: 14
    },
    gradeHeader: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between'
    },
    gradeHeaderText: {
        flex: 1,
        gap: 4
    },
    statusPill: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8
    },
    statusOk: {
        backgroundColor: '#def3e7'
    },
    statusWarn: {
        backgroundColor: '#fff1d4'
    },
    statusDanger: {
        backgroundColor: '#ffe3de'
    },
    statusPillText: {
        color: '#15302b',
        fontSize: 12,
        fontWeight: '700'
    },
    horizontalList: {
        marginHorizontal: -2
    },
    evaluationCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        gap: 8,
        marginRight: 10,
        padding: 14,
        width: 138
    },
    evaluationBadge: {
        alignItems: 'center',
        backgroundColor: '#e1f3ec',
        borderRadius: 14,
        height: 28,
        justifyContent: 'center',
        width: 28
    },
    evaluationBadgeText: {
        color: '#0d7b5d',
        fontSize: 13,
        fontWeight: '700'
    },
    evaluationScore: {
        color: '#15302b',
        fontSize: 26,
        fontWeight: '700'
    },
    miniGradeCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        flexBasis: '47%',
        flexGrow: 1,
        gap: 6,
        padding: 14
    },
    miniGradeCardFeatured: {
        backgroundColor: '#e4f5ef'
    },
    miniGradeValue: {
        color: '#15302b',
        fontSize: 24,
        fontWeight: '700'
    },
    miniGradeValueFeatured: {
        color: '#0d7b5d'
    },
    subjectChip: {
        backgroundColor: '#f3f7f5',
        borderRadius: 18,
        gap: 4,
        marginRight: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        width: 176
    },
    subjectChipActive: {
        backgroundColor: '#113b33'
    },
    subjectChipCode: {
        color: '#607670',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.7,
        textTransform: 'uppercase'
    },
    subjectChipCodeActive: {
        color: '#aee8d7'
    },
    subjectChipText: {
        color: '#15302b',
        fontSize: 14,
        fontWeight: '600'
    },
    subjectChipTextActive: {
        color: '#ffffff'
    },
    secondaryButton: {
        alignItems: 'center',
        borderColor: '#b9d7cd',
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 16
    },
    secondaryButtonText: {
        color: '#0d7b5d',
        fontSize: 15,
        fontWeight: '700'
    },
    selectedSubjectCard: {
        backgroundColor: '#eef7f3',
        borderRadius: 22,
        gap: 8,
        padding: 14
    },
    lessonCard: {
        backgroundColor: '#f8fbf9',
        borderRadius: 22,
        gap: 12,
        padding: 14
    },
    lessonDateBox: {
        alignItems: 'flex-start',
        backgroundColor: '#edf3ff',
        borderRadius: 18,
        gap: 4,
        padding: 12
    },
    lessonDate: {
        color: '#245fd9',
        fontSize: 14,
        fontWeight: '700'
    },
    lessonWorkload: {
        color: '#5f76b8',
        fontSize: 12,
        fontWeight: '700'
    },
    lessonBody: {
        gap: 4
    },
    emptyInline: {
        backgroundColor: '#f5f8f6',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 16
    },
    emptyInlineText: {
        color: '#62756d',
        fontSize: 14,
        textAlign: 'center'
    },
    bottomNav: {
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderTopColor: '#d7e3dd',
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: Platform.OS === 'ios' ? 24 : 16,
        paddingHorizontal: 10,
        paddingTop: 10
    },
    navItem: {
        alignItems: 'center',
        borderRadius: 18,
        flex: 1,
        gap: 6,
        paddingVertical: 10
    },
    navItemActive: {
        backgroundColor: '#e2f4ed'
    },
    navText: {
        color: '#607670',
        fontSize: 11,
        fontWeight: '700'
    },
    navTextActive: {
        color: '#0d7b5d'
    },
    skeletonBlock: {
        backgroundColor: '#e7efeb',
        borderRadius: 24
    }
});

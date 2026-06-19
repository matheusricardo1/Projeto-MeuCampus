'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
} from 'lucide-react';
import { useEcampusWorkspace } from '@/presentation/hooks/use-ecampus-workspace';

type Workspace = ReturnType<typeof useEcampusWorkspace>;

export function EcampusWorkspace() {
    const workspace = useEcampusWorkspace();
    const { restoreSession } = workspace;
    const didRestoreSession = useRef(false);

    useEffect(() => {
        if (didRestoreSession.current) return;
        didRestoreSession.current = true;
        void restoreSession();
    }, [restoreSession]);

    if (!workspace.isAuthenticated) {
        return (
            <main className="workspace workspace--center">
                <LoginPanel isLoading={workspace.isLoading} error={workspace.error} onSubmit={workspace.login} />
            </main>
        );
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
        <main className="workspace workspace--dashboard">
            <header className="appHeader">
                <div className="headerIdentity">
                    <div className="headerAvatar">{getInitials(displayName)}</div>
                    <div>
                        <span className="eyebrow">UFAM Academics</span>
                        <strong>{activeTab.label}</strong>
                        <small>{displayName}</small>
                    </div>
                </div>
                <button className="iconButton headerLogout" type="button" onClick={workspace.logout} title="Sair" aria-label="Sair">
                    <LogOut size={18} />
                </button>
            </header>

            <section className="dashboardIntro">
                <div>
                    <div className="activeLabel">
                        <ActiveIcon size={18} />
                        {activeTab.label}
                    </div>
                    <h1>{workspace.profile?.academic.course || 'eCampus'}</h1>
                    <p>{workspace.profile?.academic.enrollment_number ? `Matricula ${workspace.profile.academic.enrollment_number}` : 'Dados academicos'}</p>
                </div>
                <button className="refreshChip" disabled={workspace.isLoading} type="button" onClick={() => void activeTab.action()}>
                    <RefreshCw size={16} />
                    Atualizar
                </button>
            </section>

            {workspace.error ? <div className="status status--error">{workspace.error}</div> : null}

            <section className="contentBand">
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
                        subjects={workspace.lessonPlanSubjects}
                        selectedSubjectCode={workspace.selectedLessonPlanSubjectCode}
                        onChangeSubjectCode={workspace.changeLessonPlanSubject}
                        onRefresh={workspace.loadLessonPlan}
                        onRefreshSubjects={workspace.loadLessonPlanSubjects}
                    />
                ) : null}
            </section>

            <nav className="bottomNav" aria-label="Navegacao principal">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            className={workspace.activeTab === tab.id ? 'navItem navItem--active' : 'navItem'}
                            key={tab.id}
                            type="button"
                            onClick={() => {
                                workspace.openTab(tab.id);
                            }}
                        >
                            <Icon size={20} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </nav>
        </main>
    );
}

function LoginPanel({
    error,
    isLoading,
    onSubmit
}: {
    error: string | null;
    isLoading: boolean;
    onSubmit: (input: { user: string; password: string }) => Promise<void>;
}) {
    const [user, setUser] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    return (
        <section className="loginSurface">
            <div className="loginHeader">
                <div className="loginMark">
                    <ShieldCheck size={28} />
                </div>
                <div>
                    <p className="eyebrow">Acesso eCampus</p>
                    <h1>UFAM Academics</h1>
                    <p>Entre com sua conta institucional</p>
                </div>
            </div>

            <form
                className="loginForm"
                onSubmit={(event) => {
                    event.preventDefault();
                    void onSubmit({ user: onlyDigits(user), password });
                }}
            >
                <label>
                    CPF
                    <input
                        value={user}
                        onChange={(event) => setUser(formatCpf(event.target.value))}
                        autoComplete="username"
                        inputMode="numeric"
                        maxLength={14}
                        placeholder="000.000.000-00"
                    />
                </label>
                <label>
                    Senha
                    <div className="passwordField">
                        <input
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                        />
                        <button
                            className="passwordToggle"
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </label>
                {error ? <div className="status status--error">{error}</div> : null}
                <button className="primaryButton" disabled={isLoading} type="submit">
                    <ShieldCheck size={18} />
                    {isLoading ? 'Entrando' : 'Entrar'}
                </button>
            </form>
        </section>
    );
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

    if (isLoading && !profile && schedule.length === 0 && grades.length === 0) return <DashboardSkeleton />;

    return (
        <div className="screenStack">
            <section className="homeHero">
                <div>
                    <span className="sectionKicker">Resumo academico</span>
                    <strong>{profile?.personal.full_name || 'Carregando dados'}</strong>
                    <p>{profile?.academic.course || 'Seu painel vai aparecer aqui assim que os dados chegarem.'}</p>
                </div>
                <div className="homeHeroScore">
                    <span>Media</span>
                    <strong>{averageNumber === null ? '-' : averageNumber.toFixed(1)}</strong>
                </div>
            </section>

            <section className="dashboardMetricGrid">
                <MetricCard label="Materias" value={String(subjectCount)} />
                <MetricCard label="Aulas semanais" value={String(schedule.length)} />
                <MetricCard label="Atividades" value={String(activityCount)} />
                <MetricCard label="Faltas" value={String(totalAbsences)} />
            </section>

            <section className="dashboardGrid">
                <article className="panel dashboardPanel">
                    <PanelHeader title={nextClass?.isHappening ? 'Aula acontecendo' : 'Proxima aula'} loading={isLoading} onRefresh={workspace.refreshDashboard} />
                    <div className="nextClassCard">
                        <div>
                            <span>{nextClass?.label || 'Horario'}</span>
                            <strong>{nextClass?.item.subject || 'Nenhuma aula carregada'}</strong>
                            <p>{nextClass ? `${nextClass.item.start_time} ate ${nextClass.item.end_time}` : 'Atualize para buscar seu horario.'}</p>
                        </div>
                        <div className="nextClassTime">{nextClass?.item.start_time || '--:--'}</div>
                    </div>
                </article>

                <article className="panel dashboardPanel">
                    <PanelHeader title="Semana" loading={isLoading} onRefresh={workspace.loadSchedule} />
                    <div className="weekChart">
                        {weekMap.map((day) => (
                            <div className="weekBar" key={day.weekday}>
                                <div>
                                    <i style={{ height: `${Math.max(12, (day.items.length / chartMax) * 92)}px` }} />
                                </div>
                                <span>{day.short}</span>
                                <strong>{day.items.length}</strong>
                            </div>
                        ))}
                    </div>
                </article>
            </section>

            <section className="dashboardGrid">
                <article className="panel dashboardPanel">
                    <PanelHeader title="Notas" loading={isLoading} onRefresh={workspace.loadGrades} />
                    <div className="gradeHealth">
                        <div className="gradeRing" style={{ '--grade-progress': `${Math.min(100, Math.max(0, (averageNumber || 0) * 10))}%` } as CSSProperties}>
                            <strong>{averageNumber === null ? '-' : averageNumber.toFixed(1)}</strong>
                            <span>geral</span>
                        </div>
                        <div className="gradeHealthStats">
                            <span><strong>{approved}</strong> aprovadas</span>
                            <span><strong>{grades.length - approved}</strong> em atencao</span>
                            <span><strong>{grades.length}</strong> lancadas</span>
                        </div>
                    </div>
                </article>

                <article className="panel dashboardPanel">
                    <PanelHeader title="Pontos de atencao" loading={isLoading} onRefresh={workspace.loadGrades} />
                    <div className="attentionList">
                        {weakestGrades.length === 0 ? <EmptyInline text="Nenhuma nota carregada." /> : null}
                        {weakestGrades.map(({ grade }) => (
                            <div className="attentionItem" key={`${grade.code}-${grade.subject}`}>
                                <span>{grade.code}</span>
                                <strong>{grade.subject}</strong>
                                <small>MF {grade.final_grade || '-'}</small>
                            </div>
                        ))}
                    </div>
                </article>
            </section>
        </div>
    );
}

function ProfilePanel({ loading, onRefresh, profile }: { loading: boolean; onRefresh: () => Promise<void>; profile: Workspace['profile'] }) {
    if (loading && !profile) return <ProfileSkeleton />;
    if (!profile) return <EmptyState loading={loading} onRefresh={onRefresh} label="Carregar perfil" />;

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
        <div className="screenStack">
            <section className="profileHero">
                <div className="profileAvatar">{getInitials(profile.personal.full_name)}</div>
                <div>
                    <span>Aluno</span>
                    <h2>{profile.personal.full_name || '-'}</h2>
                    <p>{profile.academic.course || '-'}</p>
                </div>
            </section>

            <section className="quickGrid">
                {contactRows.map((row) => {
                    const Icon = row.icon;
                    return (
                        <div className="quickTile" key={row.label}>
                            <Icon size={18} />
                            <span>{row.label}</span>
                            <strong>{row.value || '-'}</strong>
                        </div>
                    );
                })}
            </section>

            <section className="panel">
                <PanelHeader title="Dados academicos" loading={loading} onRefresh={onRefresh} />
                <div className="detailsGrid">
                    {rows.map(([label, value]) => (
                        <div className="detailItem" key={label}>
                            <span>{label}</span>
                            <strong>{value || '-'}</strong>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

function SchedulePanel({ loading, onRefresh, schedule }: { loading: boolean; onRefresh: () => Promise<void>; schedule: Workspace['schedule'] }) {
    const groupedSchedule = useMemo(() => groupScheduleByDay(schedule), [schedule]);
    const weekMap = useMemo(() => buildWeekMap(groupedSchedule), [groupedSchedule]);
    const busiestDay = weekMap.reduce((current, day) => (day.items.length > current.items.length ? day : current), weekMap[0]!);
    const nextClass = useMemo(() => getNextScheduleClass(schedule), [schedule]);

    if (loading && schedule.length === 0) return <ScheduleSkeleton />;

    return (
        <div className="screenStack">
            <section className="metricStrip">
                <MetricCard label="Aulas" value={String(schedule.length)} />
                <MetricCard label="Dias" value={String(groupedSchedule.length)} />
                <MetricCard label="Pico" value={busiestDay.items.length ? busiestDay.short : '-'} />
            </section>

            <section className="scheduleHero">
                <div>
                    <span className="sectionKicker">{nextClass?.isHappening ? 'Aula agora' : 'Proxima aula'}</span>
                    <strong>{nextClass?.item.subject || 'Sem horario carregado'}</strong>
                    <p>
                        {nextClass
                            ? `${nextClass.label} - ${nextClass.item.start_time} ate ${nextClass.item.end_time}`
                            : 'Atualize para montar seu horario semanal.'}
                    </p>
                </div>
                <div className="nextTime">
                    <Clock3 size={18} />
                    <strong>{nextClass?.item.start_time || '--:--'}</strong>
                </div>
            </section>

            <section className="panel">
                <PanelHeader title="Horario semanal" loading={loading} onRefresh={onRefresh} />
                {schedule.length === 0 ? <EmptyInline text="Nenhuma aula carregada." /> : null}
                <div className="weekSummary">
                    {weekMap.map((day) => (
                        <span className={day.items.length ? 'weekChip weekChip--active' : 'weekChip'} key={day.weekday}>
                            <strong>{day.short}</strong>
                            {day.items.length}
                        </span>
                    ))}
                </div>
                <div className="scheduleBoard">
                    {weekMap.filter((day) => day.items.length > 0).map((group) => (
                        <section className="scheduleLane" key={group.weekday}>
                            <div className="laneHeader">
                                <strong>{group.label}</strong>
                                <span>{group.items.length} aula{group.items.length === 1 ? '' : 's'}</span>
                            </div>
                            {group.items.map((item, index) => (
                                <article className={`scheduleEvent scheduleEvent--${index % 4}`} key={`${item.weekday}-${item.start_time}-${item.class_identifier}`}>
                                    <div className="eventTime">
                                        <strong>{item.start_time}</strong>
                                        <span>{item.end_time}</span>
                                    </div>
                                    <div className="eventBody">
                                        <span>{item.code}</span>
                                        <strong>{item.subject}</strong>
                                        <p>{item.class_identifier}</p>
                                    </div>
                                </article>
                            ))}
                        </section>
                    ))}
                </div>
            </section>
        </div>
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
    const average = averageNumber === null ? '-' : averageNumber.toFixed(1);
    const approved = grades.filter((grade) => isApprovedStatus(grade.status)).length;
    const totalAbsences = grades.reduce((sum, grade) => sum + parseAbsences(grade.absences), 0);
    const pending = grades.length - approved;

    return (
        <div className="screenStack">
            <section className="gradeOverview">
                <div>
                    <span className="sectionKicker">Boletim do periodo</span>
                    <strong>{average}</strong>
                    <p>Media geral</p>
                </div>
                <div className="gradeOverviewStats">
                    <span><strong>{grades.length}</strong> materias</span>
                    <span><strong>{approved}</strong> aprovadas</span>
                    <span><strong>{pending}</strong> em aberto</span>
                    <span><strong>{totalAbsences}</strong> faltas</span>
                </div>
            </section>

            <section className="panel">
                <PanelHeader title="Notas e frequencia" loading={loading} onRefresh={onRefresh} />
                <div className="inlineControls">
                    <label>
                        Ano
                        <input value={input.year} onChange={(event) => onChange({ ...input, year: event.target.value })} inputMode="numeric" />
                    </label>
                    <label>
                        Periodo
                        <input value={input.period} onChange={(event) => onChange({ ...input, period: event.target.value })} inputMode="numeric" />
                    </label>
                    <button className="iconButton" type="button" onClick={() => void onRefresh()} title="Buscar notas">
                        <RefreshCw size={18} />
                    </button>
                </div>
                <div className="gradeList">
                    {grades.length === 0 ? <EmptyInline text="Nenhuma nota carregada." /> : null}
                    {grades.map((grade) => (
                        <article className="gradeRow" key={`${grade.code}-${grade.subject}`}>
                            <header className="gradeRowHeader">
                                <div className="gradeRowSubject">
                                    <span>{grade.code}{grade.class_identifier ? ` - ${grade.class_identifier}` : ''}</span>
                                    <strong>{grade.subject}</strong>
                                </div>
                                <span className={`statusPill ${getGradeTone(grade.status)}`}>{grade.status || '-'}</span>
                            </header>

                            {grade.evaluations.length > 0 ? (
                                <section className="evaluationSection">
                                    <span className="gradeSectionTitle">Atividades lancadas</span>
                                    <div className="evaluationList">
                                        {grade.evaluations.map((evaluation, index) => (
                                            <div className="evaluationItem" key={`${grade.code}-${evaluation.label}`}>
                                                <div className="evaluationIndex">{index + 1}</div>
                                                <div>
                                                    <span>Atividade {index + 1}</span>
                                                    <strong>{evaluation.score || '-'}</strong>
                                                </div>
                                                <small>Peso {evaluation.weight || '-'}</small>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ) : (
                                <p className="gradeEmpty">Sem atividades lancadas.</p>
                            )}

                            <section className="gradeClosing">
                                <span className="gradeSectionTitle">Fechamento</span>
                                <div className="gradeSummaryGrid">
                                    <GradeSummary label="ME" value={grade.exercise_average || '-'} helper="Media dos exercicios" />
                                    <GradeSummary label="PF" value={grade.final_exam || '-'} helper="Prova final" />
                                    <GradeSummary label="MF" value={grade.final_grade || '-'} helper="Media final" featured />
                                    <GradeSummary label="FT" value={grade.absences || '-'} helper="Faltas" />
                                </div>
                            </section>
                        </article>
                    ))}
                </div>
            </section>
        </div>
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
        <div className="screenStack">
            <section className="metricStrip">
                <MetricCard label="Materias" value={String(subjects.length)} />
                <MetricCard label="Com plano" value={String(availableSubjects)} />
                <MetricCard label="Aulas" value={String(items.length)} />
            </section>

            <section className="panel">
                <PanelHeader title="Plano de ensino" loading={loading} onRefresh={onRefreshSubjects} />
                <div className="inlineControls inlineControls--lessonPlan">
                    <label>
                        Materia
                        <select value={selectedSubjectCode} onChange={(event) => onChangeSubjectCode(event.target.value)}>
                            <option value="">Selecione uma materia</option>
                            {subjects.map((subject) => (
                                <option key={`${subject.code}-${subject.classIdentifier}`} value={subject.code}>
                                    {subject.code} - {subject.subject}{subject.available ? '' : ' (indisponivel)'}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button className="iconButton" type="button" onClick={() => void onRefresh()} title="Buscar plano">
                        <RefreshCw size={18} />
                    </button>
                </div>
                {selectedSubject ? (
                    <div className="selectedSubject">
                        <div>
                            <span className={selectedSubject.available ? 'statusPill statusPill--ok' : 'statusPill statusPill--warn'}>
                                {selectedSubject.available ? 'Disponivel' : 'Indisponivel'}
                            </span>
                            <strong>{selectedSubject.subject}</strong>
                            <span>{selectedSubject.code} - {selectedSubject.classIdentifier || 'Turma nao informada'}</span>
                            <span>{selectedSubject.professor || 'Docente nao informado'}</span>
                        </div>
                    </div>
                ) : null}
                {items.length === 0 ? <EmptyInline text="Nenhum item carregado." /> : null}
                <div className="timeline">
                    {items.map((item, index) => (
                        <article className="timelineItem" key={`${item.date}-${item.content}-${index}`}>
                            <div className="timelineDate">
                                <strong>{item.date || '-'}</strong>
                                <span>{formatWorkload(item.workload)}</span>
                            </div>
                            <div className="timelineBody">
                                <span>{item.type || 'Aula'}</span>
                                <strong>{item.content || '-'}</strong>
                                <p>{item.professor || '-'}</p>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}

function PanelHeader({ loading, onRefresh, title }: { loading: boolean; onRefresh: () => Promise<void>; title: string }) {
    return (
        <div className="panelHeader">
            <h2>{title}</h2>
            <button className="iconButton" disabled={loading} type="button" onClick={() => void onRefresh()} title="Atualizar">
                <RefreshCw size={18} />
            </button>
        </div>
    );
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="metricCard">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function GradeSummary({ featured = false, helper, label, value }: { featured?: boolean; helper: string; label: string; value: string }) {
    return (
        <div className={featured ? 'gradeSummary gradeSummary--featured' : 'gradeSummary'}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{helper}</small>
        </div>
    );
}

function EmptyState({ label, loading, onRefresh }: { label: string; loading: boolean; onRefresh: () => Promise<void> }) {
    return (
        <div className="panel emptyState">
            <button className="primaryButton" disabled={loading} type="button" onClick={() => void onRefresh()}>
                <RefreshCw size={18} />
                {loading ? 'Carregando' : label}
            </button>
        </div>
    );
}

function EmptyInline({ text }: { text: string }) {
    return <p className="emptyInline">{text}</p>;
}

function DashboardSkeleton() {
    return (
        <div className="screenStack">
            <section className="homeHero skeletonBlock skeletonHero" />
            <section className="dashboardMetricGrid">
                {Array.from({ length: 4 }).map((_, index) => <div className="metricCard skeletonBlock" key={index} />)}
            </section>
            <section className="dashboardGrid">
                <div className="panel skeletonPanel" />
                <div className="panel skeletonPanel" />
            </section>
        </div>
    );
}

function ProfileSkeleton() {
    return (
        <div className="screenStack">
            <section className="profileHero skeletonBlock skeletonHero" />
            <section className="quickGrid">
                <div className="quickTile skeletonBlock" />
                <div className="quickTile skeletonBlock" />
            </section>
            <section className="panel">
                <SkeletonLines count={6} />
            </section>
        </div>
    );
}

function ScheduleSkeleton() {
    return (
        <div className="screenStack">
            <section className="metricStrip">
                {Array.from({ length: 3 }).map((_, index) => <div className="metricCard skeletonBlock" key={index} />)}
            </section>
            <section className="scheduleHero skeletonBlock skeletonHero" />
            <section className="panel">
                <SkeletonLines count={5} />
            </section>
        </div>
    );
}

function GradesSkeleton() {
    return (
        <div className="screenStack">
            <section className="gradeOverview skeletonBlock skeletonHero" />
            <section className="panel">
                <SkeletonLines count={7} />
            </section>
        </div>
    );
}

function LessonPlanSkeleton() {
    return (
        <div className="screenStack">
            <section className="metricStrip">
                {Array.from({ length: 3 }).map((_, index) => <div className="metricCard skeletonBlock" key={index} />)}
            </section>
            <section className="panel">
                <SkeletonLines count={6} />
            </section>
        </div>
    );
}

function SkeletonLines({ count }: { count: number }) {
    return (
        <div className="skeletonLines">
            {Array.from({ length: count }).map((_, index) => <span className="skeletonBlock" key={index} />)}
        </div>
    );
}

function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return `${words[0]?.[0] || 'U'}${words[1]?.[0] || 'A'}`.toUpperCase();
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

function getGradeTone(status: string): string {
    const normalized = status.toLowerCase();
    if (normalized.includes('aprov')) return 'statusPill--ok';
    if (normalized.includes('reprov')) return 'statusPill--danger';
    return 'statusPill--warn';
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

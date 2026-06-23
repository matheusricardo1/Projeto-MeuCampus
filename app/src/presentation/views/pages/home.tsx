import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '@/presentation/design-system';
import type { Workspace } from '@/presentation/views/workspace.types';
import { EmptyInline, MetricCard, PanelHeader, SkeletonBlock, StatPill } from '@/presentation/views/components';
import { buildWeekMap, getNextScheduleClass, groupScheduleByDay, isApprovedStatus, parseAbsences, parseGrade, useResponsiveLayout } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function DashboardPage({ workspace }: { workspace: Workspace }) {
    const layout = useResponsiveLayout();
    const { grades, isLoading, lessonPlanSubjects, profile, schedule } = workspace;
    const groupedSchedule = groupScheduleByDay(schedule);
    const weekMap = buildWeekMap(groupedSchedule);
    const nextClass = getNextScheduleClass(schedule);
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
                        <Text style={styles.highlightText}>{nextClass ? `${nextClass.item.start_time} ate ${nextClass.item.end_time}` : 'Atualize para buscar seu horario semanal.'}</Text>
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

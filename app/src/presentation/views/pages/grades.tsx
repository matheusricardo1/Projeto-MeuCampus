import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { colors } from '@/presentation/design-system';
import type { Workspace } from '@/presentation/views/workspace.types';
import { EmptyInline, Field, MiniGrade, PanelHeader, SkeletonBlock } from '@/presentation/views/components';
import { gradeToneStyle, isApprovedStatus, parseAbsences, parseGrade, useResponsiveLayout } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function GradesPage({ grades, input, loading, onChange, onRefresh }: { grades: Workspace['grades']; input: Workspace['gradesInput']; loading: boolean; onChange: Workspace['setGradesInput']; onRefresh: () => Promise<void>; }) {
    const layout = useResponsiveLayout();
    if (loading && grades.length === 0) return <GradesSkeleton />;

    const numericGrades = grades.map((grade) => parseGrade(grade.final_grade)).filter((grade): grade is number => grade !== null);
    const averageNumber = numericGrades.length ? numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length : null;
    const approved = grades.filter((grade) => isApprovedStatus(grade.status)).length;
    const totalAbsences = grades.reduce((sum, grade) => sum + parseAbsences(grade.absences), 0);
    const pending = grades.length - approved;

    return (
        <View style={styles.sectionStack}>
            <View style={styles.panel}>
                <Text style={styles.sectionKicker}>Boletim do periodo</Text>
                <Text style={styles.bigNumber}>{averageNumber === null ? '-' : averageNumber.toFixed(1)}</Text>
                <Text style={styles.panelDescription}>Media geral</Text>
                <View style={[styles.gradeOverviewGrid, layout.isTablet ? styles.metricGridWide : null]}>
                    <MiniGrade label="Materias" value={String(grades.length)} helper="Disciplinas exibidas" />
                    <MiniGrade label="Aprovadas" value={String(approved)} helper="Com status positivo" />
                    <MiniGrade label="Em aberto" value={String(pending)} helper="Precisam de atencao" />
                    <MiniGrade label="Faltas" value={String(totalAbsences)} helper="Total de ausencias" />
                </View>
            </View>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefresh} title="Notas e frequencia" />
                <View style={[styles.inputRow, layout.isTablet ? styles.inputRowWide : null]}>
                    <Field compact label="Ano"><TextInput inputMode="numeric" onChangeText={(value) => onChange({ ...input, year: value })} placeholder="2026" placeholderTextColor={colors.textSubtle} style={styles.textInput} value={input.year} /></Field>
                    <Field compact label="Periodo"><TextInput inputMode="numeric" onChangeText={(value) => onChange({ ...input, period: value })} placeholder="1" placeholderTextColor={colors.textSubtle} style={styles.textInput} value={input.period} /></Field>
                    <Pressable onPress={() => void onRefresh()} style={styles.iconButton}><RefreshCw color={colors.text} size={18} /></Pressable>
                </View>

                <View style={styles.listStack}>
                    {grades.length === 0 ? <EmptyInline text="Nenhuma nota carregada." /> : null}
                    {grades.map((grade) => (
                        <View key={`${grade.code}-${grade.subject}`} style={styles.gradeCard}>
                            <View style={styles.gradeHeader}>
                                <View style={styles.gradeHeaderText}><Text style={styles.smallCaps}>{grade.code}{grade.class_identifier ? ` - ${grade.class_identifier}` : ''}</Text><Text style={styles.eventTitle}>{grade.subject}</Text></View>
                                <View style={[styles.statusPill, gradeToneStyle(grade.status)]}><Text style={styles.statusPillText}>{grade.status || '-'}</Text></View>
                            </View>

                            {grade.evaluations.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
                                    {grade.evaluations.map((evaluation, index) => (
                                        <View key={`${grade.code}-${index}`} style={styles.evaluationCard}>
                                            <View style={styles.evaluationBadge}><Text style={styles.evaluationBadgeText}>{index + 1}</Text></View>
                                            <Text style={styles.smallCaps}>Atividade {index + 1}</Text>
                                            <Text style={styles.evaluationScore}>{evaluation.score || '-'}</Text>
                                            <Text style={styles.panelDescription}>Peso {evaluation.weight || '-'}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : <EmptyInline text="Sem atividades lancadas." />}

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

function GradesSkeleton() {
    return <View style={styles.sectionStack}><SkeletonBlock height={184} /><SkeletonBlock height={360} /></View>;
}

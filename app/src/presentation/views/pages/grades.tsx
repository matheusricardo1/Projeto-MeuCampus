import { Pressable, Text, TextInput, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { colors } from '@/presentation/design-system';
import { useLanguage } from '@/presentation/i18n/language-provider';
import type { Workspace } from '@/presentation/views/workspace.types';
import { EmptyInline, Field, MiniGrade, PanelHeader, SkeletonBlock } from '@/presentation/views/components';
import { gradeToneStyle, isApprovedStatus, parseGrade, useResponsiveLayout } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function GradesPage({ grades, input, loading, onChange, onRefresh }: { grades: Workspace['grades']; input: Workspace['gradesInput']; loading: boolean; onChange: Workspace['setGradesInput']; onRefresh: () => Promise<void>; }) {
    const layout = useResponsiveLayout();
    const { t } = useLanguage();
    if (loading && grades.length === 0) return <GradesSkeleton />;

    const numericGrades = grades.map((grade) => parseGrade(grade.final_grade)).filter((grade): grade is number => grade !== null);
    const averageNumber = numericGrades.length ? numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length : null;
    const approved = grades.filter((grade) => isApprovedStatus(grade.status)).length;
    const pending = grades.length - approved;

    return (
        <View style={styles.sectionStack}>
            <View style={styles.panel}>
                <Text style={styles.sectionKicker}>{t('grades.periodReport')}</Text>
                <Text style={styles.bigNumber}>{averageNumber === null ? '-' : averageNumber.toFixed(1)}</Text>
                <Text style={styles.panelDescription}>{t('grades.generalAverage')}</Text>
                <View style={[styles.gradeOverviewGrid, layout.isTablet ? styles.metricGridWide : null]}>
                    <MiniGrade label={t('grades.subjects')} value={String(grades.length)} helper={t('grades.displayedSubjects')} />
                    <MiniGrade label={t('grades.approved')} value={String(approved)} helper={t('grades.positiveStatus')} />
                    <MiniGrade label={t('grades.open')} value={String(pending)} helper={t('grades.needAttention')} />
                </View>
            </View>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefresh} title={t('grades.gradesAndAttendance')} />
                <View style={[styles.inputRow, layout.isTablet ? styles.inputRowWide : null]}>
                    <Field compact label={t('grades.year')}><TextInput inputMode="numeric" onChangeText={(value) => onChange({ ...input, year: value })} placeholder="2026" placeholderTextColor={colors.textSubtle} style={styles.textInput} value={input.year} /></Field>
                    <Field compact label={t('grades.period')}><TextInput inputMode="numeric" onChangeText={(value) => onChange({ ...input, period: value })} placeholder="1" placeholderTextColor={colors.textSubtle} style={styles.textInput} value={input.period} /></Field>
                    <Pressable onPress={() => void onRefresh()} style={styles.iconButton}><RefreshCw color={colors.text} size={18} /></Pressable>
                </View>

                <View style={styles.listStack}>
                    {grades.length === 0 ? <EmptyInline text={t('grades.noGrades')} /> : null}
                    {grades.map((grade) => (
                        <View key={`${grade.code}-${grade.subject}`} style={styles.gradeCard}>
                            <View style={styles.gradeHeader}>
                                <View style={styles.gradeHeaderText}><Text style={styles.smallCaps}>{grade.code}{grade.class_identifier ? ` - ${grade.class_identifier}` : ''}</Text><Text style={styles.eventTitle}>{grade.subject}</Text></View>
                                <View style={[styles.statusPill, gradeToneStyle(grade.status)]}><Text style={styles.statusPillText}>{grade.status || '-'}</Text></View>
                            </View>

                            <View style={[styles.metricGrid, layout.isTablet ? styles.metricGridWide : null]}>
                                <MiniGrade featured label="MF" value={grade.final_grade || '-'} helper={t('grades.finalAverage')} />
                                <MiniGrade label="FT" value={grade.absences || '-'} helper={t('home.registeredAbsences')} />
                                <MiniGrade label="AV" value={String(grade.evaluations.length)} helper={t('grades.evaluations')} />
                                {grade.final_exam ? <MiniGrade label="PF" value={grade.final_exam} helper={t('grades.finalExam')} /> : null}
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

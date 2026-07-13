import { Pressable, Text, TextInput, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { colors } from '@/shared/design-system';
import { useLanguage } from '@/shared/i18n/language-provider';
import type { Workspace } from '@/modules/academic/presentation/views/workspace.types';
import { EmptyInline, Field, MiniGrade, PanelHeader, SkeletonBlock, SkeletonCircle } from '@/modules/academic/presentation/views/components';
import { gradeToneStyle, isApprovedStatus, isFinalExamWaived, parseGrade, useResponsiveLayout } from '@/modules/academic/presentation/views/workspace.utils';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';

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
                <Text style={styles.bigNumber}>{averageNumber === null ? '-' : averageNumber.toFixed(2)}</Text>
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
                    <Pressable onPress={() => void onRefresh()} style={({ pressed }) => [styles.iconButton, pressed ? styles.pressedFeedback : null]}><RefreshCw color={colors.text} size={18} /></Pressable>
                </View>

                <View style={styles.listStack}>
                    {grades.length === 0 ? <EmptyInline text={t('grades.noGrades')} /> : null}
                    {grades.map((grade) => {
                        const mee = parseGrade(grade.exercise_average);
                        const pf = parseGrade(grade.final_exam);
                        const presencePercent = grade.attendance?.presence_percent ?? null;
                        const hasEnoughPresence = presencePercent === null || presencePercent >= 75;
                        const waived = isFinalExamWaived(mee, pf, hasEnoughPresence);

                        return (
                            <View key={`${grade.code}-${grade.subject}`} style={styles.gradeCard}>
                                <View style={styles.gradeHeader}>
                                    <View style={styles.gradeHeaderText}><Text style={styles.smallCaps}>{grade.code}{grade.class_identifier ? ` - ${grade.class_identifier}` : ''}</Text><Text style={styles.eventTitle}>{grade.subject}</Text></View>
                                    <View style={[styles.statusPill, gradeToneStyle(grade.status)]}><Text style={styles.statusPillText}>{grade.status || '-'}</Text></View>
                                </View>

                                <View style={[styles.metricGrid, layout.isTablet ? styles.metricGridWide : null]}>
                                    <MiniGrade featured label="MF" value={grade.final_grade || '-'} helper={t('grades.finalAverage')} />
                                    <MiniGrade label="FT" value={grade.absences || '-'} helper={t('home.registeredAbsences')} />
                                    <MiniGrade label="AV" value={String(grade.evaluations?.length ?? 0)} helper={t('grades.evaluations')} />
                                    {grade.final_exam && !waived ? <MiniGrade label="PF" value={grade.final_exam} helper={t('grades.finalExam')} /> : null}
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

function MiniGradeSkeleton({ featured = false }: { featured?: boolean }) {
    return (
        <View style={[styles.miniGradeCard, featured ? styles.miniGradeCardFeatured : null, { gap: 8 }]}>
            <SkeletonBlock height={10} style={{ width: '40%' }} />
            <SkeletonBlock height={22} style={{ width: '55%' }} />
            <SkeletonBlock height={10} style={{ width: '75%' }} />
        </View>
    );
}

function GradesSkeleton() {
    return (
        <View style={styles.sectionStack}>
            <View style={styles.panel}>
                <SkeletonBlock height={11} style={{ width: 110 }} />
                <SkeletonBlock height={40} style={{ width: 90 }} />
                <SkeletonBlock height={12} style={{ width: 140 }} />
                <View style={styles.gradeOverviewGrid}>
                    <MiniGradeSkeleton />
                    <MiniGradeSkeleton />
                    <MiniGradeSkeleton />
                </View>
            </View>

            <View style={styles.panel}>
                <View style={styles.panelHeader}>
                    <SkeletonBlock height={16} style={{ width: 160 }} />
                    <SkeletonCircle size={40} />
                </View>
                <View style={styles.inputRow}>
                    <SkeletonBlock height={52} style={{ flex: 1 }} />
                    <SkeletonBlock height={52} style={{ flex: 1 }} />
                    <SkeletonBlock height={42} style={{ width: 42 }} />
                </View>

                <View style={styles.listStack}>
                    {[0, 1, 2].map((index) => (
                        <View key={index} style={styles.gradeCard}>
                            <View style={styles.gradeHeader}>
                                <View style={[styles.gradeHeaderText, { gap: 6 }]}>
                                    <SkeletonBlock height={10} style={{ width: '30%' }} />
                                    <SkeletonBlock height={15} style={{ width: '70%' }} />
                                </View>
                                <SkeletonBlock borderRadius={999} height={26} style={{ width: 84 }} />
                            </View>
                            <View style={styles.metricGrid}>
                                <MiniGradeSkeleton featured />
                                <MiniGradeSkeleton />
                                <MiniGradeSkeleton />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

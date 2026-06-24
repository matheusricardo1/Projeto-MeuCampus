import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle, BarChart3 } from 'lucide-react-native';
import type { Workspace } from '@/presentation/views/workspace.types';
import { EmptyInline, SkeletonBlock } from '@/presentation/views/components';
import { isApprovedStatus, parseGrade } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

type CourseCard = {
    absences: string;
    available: boolean;
    classIdentifier: string;
    code: string;
    evaluations: string;
    finalGrade: string;
    attendance: Workspace['grades'][number]['attendance'] | null;
    planItems: Workspace['lessonPlan'];
    professor: string;
    status: string;
    subject: string;
};

export function LessonPlanPage({
    currentGradesInput,
    grades,
    gradesInput,
    items,
    loading,
    onChangeGradesInput,
    onChangeSubjectCode,
    onRefresh,
    onRefreshSubjects,
    profile,
    selectedSubjectCode,
    subjects
}: {
    currentGradesInput: Workspace['currentGradesInput'];
    grades: Workspace['grades'];
    gradesInput: Workspace['gradesInput'];
    items: Workspace['lessonPlan'];
    loading: boolean;
    onChangeGradesInput: Workspace['changeGradesInputAndLoad'];
    onChangeSubjectCode: (value: string) => void;
    onRefresh: () => Promise<void>;
    onRefreshSubjects: () => Promise<void>;
    profile: Workspace['profile'];
    selectedSubjectCode: string;
    subjects: Workspace['lessonPlanSubjects'];
}) {
    const [openSelector, setOpenSelector] = useState<'year' | 'period' | null>(null);
    const currentYear = Number(currentGradesInput.year);
    const admissionYear = parseAdmissionYear(profile?.academic.admission_term, currentYear);
    const yearOptions = useMemo(() => {
        const start = Number.isFinite(admissionYear) ? admissionYear : currentYear;
        const end = Number.isFinite(currentYear) ? currentYear : new Date().getFullYear();
        return Array.from({ length: Math.max(end - start + 1, 1) }, (_, index) => String(end - index));
    }, [admissionYear, currentYear]);
    const periodOptions = ['1', '2'];
    const courseName = profile?.academic.course || 'Curso nao informado';
    const courses = useMemo(() => {
        const byCode = new Map<string, CourseCard>();

        for (const grade of grades) {
            byCode.set(grade.code, {
                absences: grade.absences,
                available: true,
                classIdentifier: grade.class_identifier,
                code: grade.code,
                evaluations: grade.evaluations.map((evaluation) => `${evaluation.weight}: ${evaluation.score}`).join(' | '),
                finalGrade: grade.final_grade,
                attendance: grade.attendance,
                planItems: grade.code === selectedSubjectCode ? items : [],
                professor: '',
                status: grade.status || 'Cursando',
                subject: grade.subject
            });
        }

        for (const subject of subjects) {
            const current = byCode.get(subject.code);
            byCode.set(subject.code, {
                absences: current?.absences || '0',
                available: subject.available,
                classIdentifier: current?.classIdentifier || subject.classIdentifier,
                code: subject.code,
                evaluations: current?.evaluations || '',
                finalGrade: current?.finalGrade || '',
                attendance: current?.attendance || null,
                planItems: subject.code === selectedSubjectCode ? items : [],
                professor: subject.professor,
                status: current?.status || (subject.available ? 'Plano disponivel' : 'Plano indisponivel'),
                subject: current?.subject || subject.subject
            });
        }

        return Array.from(byCode.values()).sort((a, b) => a.subject.localeCompare(b.subject));
    }, [grades, items, selectedSubjectCode, subjects]);

    if (loading && subjects.length === 0 && grades.length === 0) return <LessonPlanSkeleton />;
    const isChangingPeriod = loading && grades.length === 0;

    const openCourse = (course: CourseCard) => {
        if (course.code !== selectedSubjectCode) {
            onChangeSubjectCode(course.code);
            void onRefresh();
        }
    };
    const changeYear = (year: string) => {
        setOpenSelector(null);
        if (year !== gradesInput.year) {
            void onChangeGradesInput({ ...gradesInput, year });
        }
    };
    const changePeriod = (period: string) => {
        setOpenSelector(null);
        if (period !== gradesInput.period) {
            void onChangeGradesInput({ ...gradesInput, period });
        }
    };

    return (
        <View style={styles.coursesScreenStack}>
            <View style={styles.coursesHero}>
                <Text style={styles.coursesTitle}>Minhas Disciplinas</Text>
                <View style={styles.coursesPeriodCard}>
                    <View style={styles.coursesPeriodSummary}>
                        <Text style={styles.coursesPeriodKicker}>Periodo academico</Text>
                        <Text style={styles.coursesPeriodTitle}>{gradesInput.year}.{gradesInput.period} - {courseName}</Text>
                        <Text style={styles.coursesPeriodMeta}>{profile?.academic.enrollment_number ? `Matricula ${profile.academic.enrollment_number}` : 'Dados academicos do eCampus'}</Text>
                    </View>

                    <View style={styles.coursesSelectorRow}>
                        <View style={styles.coursesSelectorColumn}>
                            <Text style={styles.coursesSelectorLabel}>Ano</Text>
                            <Pressable onPress={() => setOpenSelector(openSelector === 'year' ? null : 'year')} style={styles.coursesSelectorButton}>
                                <Text style={styles.coursesSelectorValue}>{gradesInput.year}</Text>
                            </Pressable>
                            {openSelector === 'year' ? (
                                <View style={styles.coursesOptionsPanel}>
                                    {yearOptions.map((year) => (
                                        <Pressable key={year} onPress={() => changeYear(year)} style={[styles.coursesOptionItem, year === gradesInput.year ? styles.coursesOptionItemActive : null]}>
                                            <Text style={[styles.coursesOptionText, year === gradesInput.year ? styles.coursesOptionTextActive : null]}>{year}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.coursesSelectorColumn}>
                            <Text style={styles.coursesSelectorLabel}>Semestre</Text>
                            <Pressable onPress={() => setOpenSelector(openSelector === 'period' ? null : 'period')} style={styles.coursesSelectorButton}>
                                <Text style={styles.coursesSelectorValue}>{formatPeriodOption(gradesInput.period, gradesInput.year, currentGradesInput)}</Text>
                            </Pressable>
                            {openSelector === 'period' ? (
                                <View style={styles.coursesOptionsPanel}>
                                    {periodOptions.map((period) => (
                                        <Pressable key={period} onPress={() => changePeriod(period)} style={[styles.coursesOptionItem, period === gradesInput.period ? styles.coursesOptionItemActive : null]}>
                                            <Text style={[styles.coursesOptionText, period === gradesInput.period ? styles.coursesOptionTextActive : null]}>{formatPeriodOption(period, gradesInput.year, currentGradesInput)}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.coursesList}>
                {isChangingPeriod ? <CourseCardsSkeleton /> : null}
                {!isChangingPeriod && courses.length === 0 ? <EmptyInline text="Nenhuma disciplina carregada." /> : null}
                {!isChangingPeriod ? courses.map((course) => (
                    <CourseSubjectCard
                        course={course}
                        key={`${course.code}-${course.classIdentifier}`}
                        onPress={() => openCourse(course)}
                    />
                )) : null}
            </View>

            <View style={styles.coursesAnalyticsCard}>
                <View style={styles.coursesAnalyticsContent}>
                    <Text style={styles.coursesAnalyticsKicker}>Recurso Premium</Text>
                    <Text style={styles.coursesAnalyticsTitle}>Graficos de Desempenho</Text>
                    <Text style={styles.coursesAnalyticsText}>Visualize sua evolucao academica comparada a media do curso.</Text>
                    <Pressable onPress={() => void onRefreshSubjects()} style={styles.coursesAnalyticsButton}>
                        <Text style={styles.coursesAnalyticsButtonText}>Ver analytics</Text>
                    </Pressable>
                </View>
                <BarChart3 color="rgba(255,255,255,0.26)" size={126} style={styles.coursesAnalyticsIcon} />
            </View>
        </View>
    );
}

function CourseSubjectCard({ course, onPress }: { course: CourseCard; onPress: () => void }) {
    const numericGrade = parseGrade(course.finalGrade);
    const frequency = course.attendance?.presence_percent;
    const hasFrequency = typeof frequency === 'number';
    const isAbsenceRisk = course.attendance?.is_absence_risk === true;
    const isRisk = isAbsenceRisk || numericGrade !== null && numericGrade < 5;
    const gradeLabel = isApprovedStatus(course.status) ? 'Media Final' : numericGrade === null ? 'Plano' : 'Nota Parcial';
    const statusColor = isRisk ? '#ba1a1a' : '#003215';

    return (
        <Pressable onPress={onPress} style={styles.courseCard}>
            <View style={styles.courseCardHeader}>
                <View style={styles.courseCardTitleBlock}>
                    <View style={[styles.courseCodeBadge, isRisk ? styles.courseCodeBadgeDanger : null]}>
                        <Text style={[styles.courseCodeText, isRisk ? styles.courseCodeTextDanger : null]}>{course.classIdentifier || course.code}</Text>
                    </View>
                    <Text style={styles.courseSubjectTitle}>{course.subject}</Text>
                </View>
                <View style={styles.courseGradeBlock}>
                    <Text style={[styles.courseGradeValue, { color: statusColor }]}>{numericGrade === null ? '-' : numericGrade.toFixed(1)}</Text>
                    <Text style={styles.courseGradeLabel}>{gradeLabel}</Text>
                </View>
            </View>

            <View style={styles.courseFrequencyBlock}>
                <View style={styles.courseFrequencyHeader}>
                    <Text style={styles.courseMetaLabel}>Frequencia</Text>
                    <Text style={[styles.courseFrequencyValue, { color: statusColor }]}>{frequency === null || frequency === undefined ? '--' : `${frequency}%`}</Text>
                </View>
                <View style={[styles.courseProgressTrack, !hasFrequency ? styles.courseProgressTrackUnavailable : isAbsenceRisk ? styles.courseProgressTrackDanger : null]}>
                    <View style={[styles.courseProgressFill, !hasFrequency ? styles.courseProgressFillUnavailable : isAbsenceRisk ? styles.courseProgressFillDanger : null, { width: `${frequency ?? 100}%` }]} />
                </View>
                {isAbsenceRisk ? (
                    <View style={styles.courseRiskRow}>
                        <AlertTriangle color="#ba1a1a" size={14} />
                        <Text style={styles.courseRiskText}>Risco de reprovacao por falta. Limite: {course.attendance?.max_absences_allowed ?? '-'} h/aula</Text>
                    </View>
                ) : null}
                {!hasFrequency ? (
                    <Text style={styles.courseFrequencyUnavailable}>Carga horaria nao informada pelo eCampus.</Text>
                ) : null}
            </View>
        </Pressable>
    );
}

function parseAdmissionYear(value: string | undefined, fallback: number): number {
    const match = value?.match(/\b(19|20)\d{2}\b/);
    const parsed = match ? Number(match[0]) : fallback;
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPeriodOption(period: string, selectedYear: string, current: Workspace['currentGradesInput']): string {
    const label = period === '1' ? '1o semestre' : '2o semestre';
    return selectedYear === current.year && period === current.period ? `${label} (atual)` : label;
}

function LessonPlanSkeleton() {
    return <View style={styles.sectionStack}><SkeletonBlock height={360} /></View>;
}

function CourseCardsSkeleton() {
    return (
        <>
            <SkeletonBlock height={128} />
            <SkeletonBlock height={128} />
            <SkeletonBlock height={128} />
        </>
    );
}

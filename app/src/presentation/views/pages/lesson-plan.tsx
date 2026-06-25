import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle, ArrowLeft, ArrowRight, BarChart3, BookOpen, CalendarClock, Check, CheckCircle2, ClipboardList, Clock3, Filter, MapPin, MoreVertical, School, Timer } from 'lucide-react-native';
import { useLanguage } from '@/presentation/i18n/language-provider';
import type { Translate } from '@/presentation/i18n/languages';
import type { Workspace } from '@/presentation/views/workspace.types';
import { EmptyInline, SkeletonBlock } from '@/presentation/views/components';
import { isApprovedStatus, parseGrade } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

type CourseCard = {
    absences: string;
    available: boolean;
    classIdentifier: string;
    code: string;
    credits: number | null;
    evaluations: string;
    evaluationItems: Array<{ score: string; weight: string }>;
    exerciseAverage: string;
    finalExam: string;
    finalGrade: string;
    attendance: Workspace['grades'][number]['attendance'] | null;
    planItems: Workspace['lessonPlan'];
    professor: string;
    scheduleItems: Workspace['schedule'];
    status: string;
    subject: string;
    workloadHours: number | null;
};

type AttendanceSummary = Workspace['grades'][number]['attendance'];

export function LessonPlanPage({
    currentGradesInput,
    grades,
    gradesInput,
    items,
    loading,
    onChangeGradesInput,
    onChangeSubjectCode,
    onNavigateScreen,
    onRefresh,
    onRefreshSubjects,
    profile,
    schedule,
    selectedSubjectCode,
    subjects
}: {
    currentGradesInput: Workspace['currentGradesInput'];
    grades: Workspace['grades'];
    gradesInput: Workspace['gradesInput'];
    items: Workspace['lessonPlan'];
    loading: boolean;
    onChangeGradesInput: Workspace['changeGradesInputAndLoad'];
    onChangeSubjectCode: (value: string) => Promise<void>;
    onNavigateScreen: () => void;
    onRefresh: () => Promise<void>;
    onRefreshSubjects: () => Promise<void>;
    profile: Workspace['profile'];
    schedule: Workspace['schedule'];
    selectedSubjectCode: string;
    subjects: Workspace['lessonPlanSubjects'];
}) {
    const { t } = useLanguage();
    const [openSelector, setOpenSelector] = useState<'year' | 'period' | null>(null);
    const [selectedCourseCode, setSelectedCourseCode] = useState('');
    const [selectedCourseView, setSelectedCourseView] = useState<'content' | 'details'>('details');
    const currentYear = Number(currentGradesInput.year);
    const admissionYear = parseAdmissionYear(profile?.academic?.admission_term, currentYear);
    const yearOptions = useMemo(() => {
        const start = Number.isFinite(admissionYear) ? admissionYear : currentYear;
        const end = Number.isFinite(currentYear) ? currentYear : new Date().getFullYear();
        return Array.from({ length: Math.max(end - start + 1, 1) }, (_, index) => String(end - index));
    }, [admissionYear, currentYear]);
    const periodOptions = ['1', '2'];
    const courseName = profile?.academic?.course || t('lesson.courseUnknown');
    const semesterLabel = t('lesson.semesterLabel', { course: courseName, period: gradesInput.period, year: gradesInput.year });
    const courses = useMemo(() => {
        const byCode = new Map<string, CourseCard>();

        for (const grade of grades) {
            byCode.set(grade.code, {
                absences: grade.absences,
                available: true,
                classIdentifier: grade.class_identifier,
                code: grade.code,
                credits: null,
                evaluations: grade.evaluations.map((evaluation) => `${evaluation.weight}: ${evaluation.score}`).join(' | '),
                evaluationItems: grade.evaluations,
                exerciseAverage: grade.exercise_average,
                finalExam: grade.final_exam,
                finalGrade: grade.final_grade,
                attendance: grade.attendance,
                planItems: grade.code === selectedSubjectCode ? items : [],
                professor: '',
                scheduleItems: schedule.filter((item) => item.code === grade.code || item.class_identifier === grade.class_identifier),
                status: grade.status || t('lesson.inProgress'),
                subject: grade.subject,
                workloadHours: grade.attendance?.workload_hours ?? null
            });
        }

        for (const subject of subjects) {
            const current = byCode.get(subject.code);
            const attendance = buildAttendanceSummary(
                current?.attendance ?? null,
                subject.workloadHours ?? current?.workloadHours ?? null,
                current?.absences || '0'
            );

            byCode.set(subject.code, {
                absences: current?.absences || '0',
                available: subject.available,
                classIdentifier: current?.classIdentifier || subject.classIdentifier,
                code: subject.code,
                credits: subject.credits,
                evaluations: current?.evaluations || '',
                evaluationItems: current?.evaluationItems || [],
                exerciseAverage: current?.exerciseAverage || '',
                finalExam: current?.finalExam || '',
                finalGrade: current?.finalGrade || '',
                attendance,
                planItems: subject.code === selectedSubjectCode ? items : [],
                professor: subject.professor,
                scheduleItems: schedule.filter((item) => item.code === subject.code || item.class_identifier === subject.classIdentifier),
                status: current?.status || (subject.available ? t('lesson.planAvailable') : t('lesson.planUnavailable')),
                subject: current?.subject || subject.subject,
                workloadHours: subject.workloadHours ?? current?.workloadHours ?? null
            });
        }

        return Array.from(byCode.values()).sort((a, b) => a.subject.localeCompare(b.subject));
    }, [grades, items, schedule, selectedSubjectCode, subjects, t]);

    if (loading && subjects.length === 0 && grades.length === 0) return <LessonPlanSkeleton />;
    const isChangingPeriod = loading && grades.length === 0;
    const selectedCourse = selectedCourseCode ? courses.find((course) => course.code === selectedCourseCode) ?? null : null;

    const openCourse = (course: CourseCard) => {
        setSelectedCourseCode(course.code);
        setSelectedCourseView('details');
        onNavigateScreen();

        if (course.code !== selectedSubjectCode) {
            void onChangeSubjectCode(course.code);
        }
    };

    if (selectedCourse) {
        const selectedCourseWithCurrentItems = { ...selectedCourse, planItems: selectedCourse.code === selectedSubjectCode ? items : selectedCourse.planItems };
        if (selectedCourseView === 'content') {
            return (
                <CourseContentScreen
                    course={selectedCourseWithCurrentItems}
                    onBack={() => {
                        setSelectedCourseView('details');
                        onNavigateScreen();
                    }}
                    t={t}
                />
            );
        }

        return (
            <CourseDetailsScreen
                course={selectedCourseWithCurrentItems}
                loading={loading && selectedCourse.code === selectedSubjectCode}
                onBack={() => {
                    setSelectedCourseCode('');
                    onNavigateScreen();
                }}
                onOpenFullContent={() => {
                    setSelectedCourseView('content');
                    onNavigateScreen();
                }}
                semester={`${gradesInput.year}.${gradesInput.period}`}
                t={t}
            />
        );
    }
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
                <Text style={styles.coursesTitle}>{t('lesson.title')}</Text>
                <Text style={styles.coursesSubtitle}>{semesterLabel}</Text>
                <Text style={styles.coursesPeriodMeta}>{profile?.academic?.enrollment_number ? t('lesson.enrollment', { enrollment: profile.academic.enrollment_number }) : t('lesson.academicData')}</Text>

                <View style={styles.coursesSelectorRow}>
                    <View style={styles.coursesSelectorColumn}>
                        <Text style={styles.coursesSelectorLabel}>{t('lesson.year')}</Text>
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
                        <Text style={styles.coursesSelectorLabel}>{t('lesson.semester')}</Text>
                        <Pressable onPress={() => setOpenSelector(openSelector === 'period' ? null : 'period')} style={styles.coursesSelectorButton}>
                            <Text style={styles.coursesSelectorValue}>{formatPeriodOption(gradesInput.period, gradesInput.year, currentGradesInput, t)}</Text>
                        </Pressable>
                        {openSelector === 'period' ? (
                            <View style={styles.coursesOptionsPanel}>
                                {periodOptions.map((period) => (
                                    <Pressable key={period} onPress={() => changePeriod(period)} style={[styles.coursesOptionItem, period === gradesInput.period ? styles.coursesOptionItemActive : null]}>
                                        <Text style={[styles.coursesOptionText, period === gradesInput.period ? styles.coursesOptionTextActive : null]}>{formatPeriodOption(period, gradesInput.year, currentGradesInput, t)}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>

            <View style={styles.coursesList}>
                {isChangingPeriod ? <CourseCardsSkeleton /> : null}
                {!isChangingPeriod && courses.length === 0 ? <EmptyInline text={t('lesson.empty')} /> : null}
                {!isChangingPeriod ? courses.map((course) => (
                    <CourseSubjectCard
                        course={course}
                        key={`${course.code}-${course.classIdentifier}`}
                        onPress={() => openCourse(course)}
                        t={t}
                    />
                )) : null}
            </View>

            <View style={styles.coursesAnalyticsCard}>
                <View style={styles.coursesAnalyticsContent}>
                    <Text style={styles.coursesAnalyticsKicker}>{t('lesson.premium')}</Text>
                    <Text style={styles.coursesAnalyticsTitle}>{t('lesson.performanceCharts')}</Text>
                    <Text style={styles.coursesAnalyticsText}>{t('lesson.analyticsText')}</Text>
                    <Pressable onPress={() => void onRefreshSubjects()} style={styles.coursesAnalyticsButton}>
                        <Text style={styles.coursesAnalyticsButtonText}>{t('lesson.viewAnalytics')}</Text>
                    </Pressable>
                </View>
                <BarChart3 color="rgba(255,255,255,0.26)" size={126} style={styles.coursesAnalyticsIcon} />
            </View>
        </View>
    );
}

function CourseSubjectCard({ course, onPress, t }: { course: CourseCard; onPress: () => void; t: Translate }) {
    const frequency = course.attendance?.presence_percent;
    const hasFrequency = typeof frequency === 'number';
    const isAbsenceRisk = course.attendance?.is_absence_risk === true;
    const gradeState = buildGradeState(course, frequency ?? null, t);
    const isRisk = isAbsenceRisk || gradeState.tone === 'danger';
    const statusColor = isAbsenceRisk ? '#ba1a1a' : gradeState.color;

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
                    <Text style={[styles.courseGradeValue, { color: statusColor }]}>{gradeState.value}</Text>
                    <Text style={styles.courseGradeLabel}>{gradeState.label}</Text>
                </View>
            </View>

            <View style={styles.courseFrequencyBlock}>
                <View style={styles.courseFrequencyHeader}>
                    <Text style={styles.courseMetaLabel}>{t('lesson.frequency')}</Text>
                    <Text style={[styles.courseFrequencyValue, { color: statusColor }]}>{frequency === null || frequency === undefined ? '--' : `${frequency}%`}</Text>
                </View>
                <View style={[styles.courseProgressTrack, !hasFrequency ? styles.courseProgressTrackUnavailable : isAbsenceRisk ? styles.courseProgressTrackDanger : null]}>
                    <View style={[styles.courseProgressFill, !hasFrequency ? styles.courseProgressFillUnavailable : isAbsenceRisk ? styles.courseProgressFillDanger : null, { width: `${frequency ?? 100}%` }]} />
                </View>
                {isAbsenceRisk ? (
                    <View style={styles.courseRiskRow}>
                        <AlertTriangle color="#ba1a1a" size={14} />
                        <Text style={styles.courseRiskText}>{t('lesson.riskByAbsence', { limit: course.attendance?.max_absences_allowed ?? '-' })}</Text>
                    </View>
                ) : null}
                {!hasFrequency ? (
                    <Text style={styles.courseFrequencyUnavailable}>{t('lesson.frequencyUnavailable')}</Text>
                ) : null}
            </View>

        </Pressable>
    );
}

function CourseDetailsScreen({ course, loading, onBack, onOpenFullContent, semester, t }: { course: CourseCard; loading: boolean; onBack: () => void; onOpenFullContent: () => void; semester: string; t: Translate }) {
    const frequency = course.attendance?.presence_percent;
    const gradeState = buildGradeState(course, frequency ?? null, t);
    const isApproved = gradeState.tone === 'success';
    const planWorkload = course.planItems.reduce((total, item) => total + (typeof item.workload === 'number' ? item.workload : 0), 0);
    const workloadLabel = course.workloadHours ?? course.attendance?.workload_hours ?? (planWorkload > 0 ? planWorkload : null);
    const evaluations = course.evaluationItems.length > 0 ? course.evaluationItems : parseEvaluationItems(course.evaluations, t);
    const previewItems = getCurrentLessonPreview(course.planItems, 3);
    const scheduleLabel = formatCourseSchedule(course.scheduleItems, t);

    return (
        <View style={styles.courseDetailsPage}>
            <View style={styles.courseDetailsTopBar}>
                <Pressable onPress={onBack} style={styles.courseDetailsIconButton}>
                    <ArrowLeft color="#003215" size={22} />
                </Pressable>
                <Text numberOfLines={1} style={styles.courseDetailsHeaderTitle}>{t('lesson.detailsTitle')}</Text>
                <View style={styles.courseDetailsIconButton}>
                    <MoreVertical color="#003215" size={22} />
                </View>
            </View>

            <View style={styles.courseDetailsHero}>
                <View style={styles.courseDetailsBadgeRow}>
                    <Text style={styles.courseDetailsCodeBadge}>{course.classIdentifier || course.code}</Text>
                    <Text style={styles.courseDetailsSemesterBadge}>{semester}</Text>
                </View>
                <Text style={styles.courseDetailsTitle}>{course.subject}</Text>
                <View style={styles.courseDetailsTeacherRow}>
                    <School color="rgba(255,255,255,0.82)" size={18} />
                    <Text style={styles.courseDetailsTeacher}>{course.professor || t('lesson.teacherUnknown')}</Text>
                </View>
            </View>

            <View style={styles.courseDetailsGrid}>
                <View style={styles.courseDetailsAverageCard}>
                    <Text style={styles.courseDetailsKicker}>{t('lesson.finalAverage')}</Text>
                    <Text style={styles.courseDetailsAverageValue}>{gradeState.value}</Text>
                    <View style={[styles.courseDetailsStatusPill, isApproved ? styles.courseDetailsStatusOk : styles.courseDetailsStatusNeutral]}>
                        <CheckCircle2 color={isApproved ? '#003215' : '#404941'} size={14} />
                        <Text style={styles.courseDetailsStatusText}>{gradeState.label}</Text>
                    </View>
                </View>

                <View style={styles.courseDetailsEvaluationsCard}>
                    <View style={styles.courseDetailsSectionHeader}>
                        <View style={styles.courseDetailsSectionTitleRow}>
                            <BarChart3 color="#003215" size={20} />
                            <Text style={styles.courseDetailsSectionTitle}>{t('grades.evaluations')}</Text>
                        </View>
                        <Text style={styles.courseDetailsMutedText}>{evaluations.length > 0 ? t('lesson.itemsCount', { count: evaluations.length }) : t('lesson.noGrades')}</Text>
                    </View>
                    <View style={styles.courseDetailsEvaluationList}>
                        {evaluations.length > 0 ? evaluations.map((evaluation, index) => (
                            <EvaluationRow evaluation={evaluation} index={index} key={`${evaluation.weight}-${index}`} t={t} />
                        )) : <EvaluationRow evaluation={{ score: '', weight: '-' }} index={0} t={t} />}
                    </View>
                </View>

                <FinalExamStatusCard course={course} frequency={frequency ?? null} t={t} />
                <AbsenceStatusCard course={course} frequency={frequency ?? null} t={t} />
                <InfoCard icon={<Clock3 color="#003215" size={20} />} label={t('lesson.schedule')} value={scheduleLabel} />
                <InfoCard icon={<Timer color="#003215" size={20} />} label={t('lesson.workload')} value={workloadLabel === null ? '-' : t('lesson.workloadHours', { hours: workloadLabel })} />
                <InfoCard icon={<MapPin color="#7b5800" size={20} />} label={t('lesson.group')} value={course.classIdentifier || '-'} />
            </View>

            <View style={styles.courseDetailsTimelineSection}>
                <View style={styles.courseDetailsSectionHeader}>
                    <View style={styles.courseDetailsSectionTitleRow}>
                        <ClipboardList color="#003215" size={20} />
                        <Text style={styles.courseDetailsSectionTitle}>{t('lesson.syllabus')}</Text>
                    </View>
                    {course.planItems.length > 3 ? (
                        <Pressable onPress={onOpenFullContent} style={styles.courseDetailsSeeAllButton}>
                            <Text style={styles.courseDetailsSeeAllText}>{t('lesson.seeFull')}</Text>
                            <ArrowRight color="#003215" size={15} />
                        </Pressable>
                    ) : loading ? <Text style={styles.courseDetailsMutedText}>{t('common.loading')}</Text> : null}
                </View>

                <View style={styles.courseDetailsTimeline}>
                    {previewItems.length > 0 ? previewItems.map((item, index) => (
                        <View key={`${item.date}-${index}`} style={styles.courseDetailsTimelineItem}>
                            <View style={styles.courseDetailsTimelineMarker}>
                                <BookOpen color="#ffffff" size={16} />
                            </View>
                            <View style={styles.courseDetailsLessonCard}>
                                <View style={styles.courseDetailsLessonHeader}>
                                    <Text style={styles.courseDetailsLessonDate}>{item.date || t('lesson.dateUnknown')}</Text>
                                    <Text style={styles.courseDetailsLessonBadge}>{typeof item.workload === 'number' ? `${item.workload}h` : t('lesson.classFallback')}</Text>
                                </View>
                                <Text style={styles.courseDetailsLessonTitle}>{item.content || t('lesson.lessonContentFallback')}</Text>
                                {item.type || item.professor ? <Text style={styles.courseDetailsLessonText}>{[item.type, item.professor].filter(Boolean).join(' - ')}</Text> : null}
                            </View>
                        </View>
                    )) : <EmptyInline text={loading ? t('lesson.syllabusLoading') : t('lesson.syllabusUnavailable')} />}
                </View>
            </View>
        </View>
    );
}

function FinalExamStatusCard({ course, frequency, t }: { course: CourseCard; frequency: number | null; t: Translate }) {
    const state = buildFinalExamStatus(course, frequency, t);
    const Icon = state.tone === 'success' ? CheckCircle2 : AlertTriangle;

    return (
        <View style={[styles.courseDetailsPfCard, state.tone === 'success' ? styles.courseDetailsPfCardSuccess : state.tone === 'danger' ? styles.courseDetailsPfCardDanger : styles.courseDetailsPfCardWarning]}>
            <View style={styles.courseDetailsPfHeader}>
                <View style={[styles.courseDetailsPfIcon, state.tone === 'success' ? styles.courseDetailsPfIconSuccess : state.tone === 'danger' ? styles.courseDetailsPfIconDanger : styles.courseDetailsPfIconWarning]}>
                    <Icon color={state.iconColor} size={20} />
                </View>
                <View style={styles.courseDetailsPfText}>
                    <Text style={styles.courseDetailsPfKicker}>{t('lesson.situationPf')}</Text>
                    <Text style={styles.courseDetailsPfTitle}>{state.title}</Text>
                </View>
            </View>
            <Text style={styles.courseDetailsPfDescription}>{state.description}</Text>
            <View style={styles.courseDetailsPfMetrics}>
                {state.metrics.map((metric) => (
                    <View key={metric.label} style={styles.courseDetailsPfMetric}>
                        <Text style={styles.courseDetailsPfMetricLabel}>{metric.label}</Text>
                        <Text style={styles.courseDetailsPfMetricValue}>{metric.value}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

function CourseContentScreen({ course, onBack, t }: { course: CourseCard; onBack: () => void; t: Translate }) {
    const [filter, setFilter] = useState<'all' | 'practical' | 'theoretical'>('all');
    const filteredItems = useMemo(() => filterLessonItems(course.planItems, filter), [course.planItems, filter]);
    const progress = buildContentProgress(course.planItems);
    const grouped = splitLessonsByCurrentDate(filteredItems);

    return (
        <View style={styles.courseContentPage}>
            <View style={styles.courseDetailsTopBar}>
                <Pressable onPress={onBack} style={styles.courseDetailsIconButton}>
                    <ArrowLeft color="#003215" size={22} />
                </Pressable>
                <Text numberOfLines={1} style={styles.courseDetailsHeaderTitle}>{t('lesson.contentTitle')}</Text>
                <View style={styles.courseDetailsIconButton}>
                    <Filter color="#003215" size={21} />
                </View>
            </View>

            <View style={styles.courseContentHero}>
                <Text style={styles.courseContentCode}>{t('lesson.code', { code: course.classIdentifier || course.code })}</Text>
                <Text style={styles.courseContentTitle}>{course.subject}</Text>
                <View style={styles.courseContentProgressBlock}>
                    <View style={styles.courseContentProgressHeader}>
                        <Text style={styles.courseContentProgressLabel}>{t('lesson.contentProgress')}</Text>
                        <Text style={styles.courseContentProgressValue}>{progress.percent}%</Text>
                    </View>
                    <View style={styles.courseContentProgressTrack}>
                        <View style={[styles.courseContentProgressFill, { width: `${progress.percent}%` }]} />
                    </View>
                    <Text style={styles.courseContentProgressHint}>{t('lesson.contentProgressHint', { done: progress.doneHours, total: progress.totalHours })}</Text>
                </View>
            </View>

            <View style={styles.courseContentTabs}>
                <Pressable onPress={() => setFilter('all')}>
                    <Text style={[styles.courseContentTab, filter === 'all' ? styles.courseContentTabActive : null]}>{t('lesson.allClasses')}</Text>
                </Pressable>
                <Pressable onPress={() => setFilter('theoretical')}>
                    <Text style={[styles.courseContentTab, filter === 'theoretical' ? styles.courseContentTabActive : null]}>{t('lesson.theoreticalOnly')}</Text>
                </Pressable>
                <Pressable onPress={() => setFilter('practical')}>
                    <Text style={[styles.courseContentTab, filter === 'practical' ? styles.courseContentTabActive : null]}>{t('lesson.practicalOnly')}</Text>
                </Pressable>
            </View>

            <LessonGroup
                emptyText={t('lesson.noUpcomingClasses')}
                items={grouped.upcoming}
                status="upcoming"
                title={t('lesson.upcomingClasses')}
                t={t}
            />
            <LessonGroup
                emptyText={t('lesson.noTaughtClasses')}
                items={grouped.taught}
                status="taught"
                title={t('lesson.taughtClasses')}
                t={t}
            />
        </View>
    );
}

function LessonGroup({ emptyText, items, status, title, t }: { emptyText: string; items: Workspace['lessonPlan']; status: 'taught' | 'upcoming'; title: string; t: Translate }) {
    return (
        <View style={styles.courseContentSection}>
            <View style={styles.courseDetailsSectionTitleRow}>
                {status === 'taught' ? <CheckCircle2 color="#79bb87" size={20} /> : <CalendarClock color="#7b5800" size={20} />}
                <Text style={styles.courseContentSectionTitle}>{title}</Text>
            </View>

            <View style={status === 'taught' ? styles.courseContentTaughtTimeline : styles.courseContentList}>
                {items.length > 0 ? items.map((item, index) => (
                    <View key={`${item.date}-${index}`} style={status === 'taught' ? styles.courseContentTaughtItem : styles.courseContentLessonCard}>
                        {status === 'taught' ? (
                            <View style={styles.courseContentCheckMarker}>
                                <Check color="#ffffff" size={14} />
                            </View>
                        ) : null}
                        <LessonContentCard item={item} status={status} t={t} />
                    </View>
                )) : <EmptyInline text={emptyText} />}
            </View>
        </View>
    );
}

function LessonContentCard({ item, status, t }: { item: Workspace['lessonPlan'][number]; status: 'taught' | 'upcoming'; t: Translate }) {
    return (
        <View style={[styles.courseContentCardInner, status === 'upcoming' ? styles.courseContentCardUpcoming : null]}>
            <View style={styles.courseContentLessonHeader}>
                <View style={styles.courseContentLessonHeading}>
                    <Text style={styles.courseContentLessonDate}>{formatLessonDateLabel(item.date, status, t)}</Text>
                    <Text style={styles.courseContentLessonTitle}>{item.content || t('lesson.lessonContentFallback')}</Text>
                </View>
                <Text style={[styles.courseContentTypeBadge, isPracticalLesson(item) ? styles.courseContentTypePractical : styles.courseContentTypeTheoretical]}>
                    {item.type || t('lesson.classFallback')}
                </Text>
            </View>
            {item.professor ? <Text style={styles.courseContentLessonText}>{item.professor}</Text> : null}
            <View style={styles.courseContentLessonFooter}>
                <View style={styles.courseContentFooterMeta}>
                    <Clock3 color="#414941" size={15} />
                    <Text style={styles.courseContentFooterText}>{formatWorkloadLabel(item.workload, t)}</Text>
                </View>
            </View>
        </View>
    );
}

function EvaluationRow({ evaluation, index, t }: { evaluation: { score: string; weight: string }; index: number; t: Translate }) {
    const score = parseGrade(evaluation.score);
    const progress = score === null ? 0 : Math.max(0, Math.min(100, score * 10));

    return (
        <View style={styles.courseDetailsEvaluationRow}>
            <View style={styles.courseDetailsEvaluationText}>
                <Text style={styles.courseDetailsEvaluationName}>{t('lesson.evaluationFallback', { count: index + 1 })}</Text>
                <Text style={styles.courseDetailsMutedText}>{t('lesson.partialEvaluation')}</Text>
            </View>
            <View style={styles.courseDetailsEvaluationScoreBlock}>
                <View style={styles.courseDetailsEvaluationTrack}>
                    <View style={[styles.courseDetailsEvaluationFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.courseDetailsEvaluationWeight}>{t('lesson.weight', { weight: evaluation.weight || '-' })}</Text>
                <Text style={styles.courseDetailsEvaluationScore}>{score === null ? 'S/N' : evaluation.score}</Text>
            </View>
        </View>
    );
}

function InfoCard({ helper, icon, label, value }: { helper?: string; icon: ReactNode; label: string; value: string }) {
    return (
        <View style={styles.courseDetailsInfoCard}>
            <View style={styles.courseDetailsInfoIcon}>{icon}</View>
            <View style={styles.courseDetailsInfoBody}>
                <Text style={styles.courseDetailsKicker}>{label}</Text>
                <Text style={styles.courseDetailsInfoValue}>{value}</Text>
                {helper ? <Text style={styles.courseDetailsMutedText}>{helper}</Text> : null}
            </View>
        </View>
    );
}

function AbsenceStatusCard({ course, frequency, t }: { course: CourseCard; frequency: number | null; t: Translate }) {
    const status = buildAbsenceStatus(course, frequency, t);
    const absencesHours = course.attendance?.absences_hours ?? parseHours(course.absences);
    const maxAbsences = course.attendance?.max_absences_allowed ?? null;
    const progress = maxAbsences && maxAbsences > 0 ? Math.min(100, Math.round((absencesHours / maxAbsences) * 100)) : frequency === null ? 0 : Math.max(0, Math.min(100, 100 - frequency));

    return (
        <View style={[styles.courseDetailsAbsenceCard, status.tone === 'alert' ? styles.courseDetailsAbsenceCardAlert : status.tone === 'warning' ? styles.courseDetailsAbsenceCardWarning : styles.courseDetailsAbsenceCardOk]}>
            <View style={styles.courseDetailsAbsenceTop}>
                <View style={[styles.courseDetailsAbsenceIcon, status.tone === 'alert' ? styles.courseDetailsAbsenceIconAlert : status.tone === 'warning' ? styles.courseDetailsAbsenceIconWarning : styles.courseDetailsAbsenceIconOk]}>
                    <CalendarClock color={status.tone === 'alert' ? '#ba1a1a' : status.tone === 'warning' ? '#7b5800' : '#003215'} size={22} />
                </View>
                <View style={styles.courseDetailsAbsenceTitleBlock}>
                    <Text style={styles.courseDetailsAbsenceKicker}>{t('lesson.absenceControl')}</Text>
                    <Text style={styles.courseDetailsAbsenceTitle}>{status.label}</Text>
                </View>
                <Text style={[styles.courseDetailsAbsenceBadge, status.tone === 'alert' ? styles.courseDetailsAbsenceBadgeAlert : status.tone === 'warning' ? styles.courseDetailsAbsenceBadgeWarning : styles.courseDetailsAbsenceBadgeOk]}>{status.label}</Text>
            </View>

            <View style={styles.courseDetailsAbsenceNumbers}>
                <View>
                    <Text style={styles.courseDetailsAbsenceNumber}>{course.absences || '-'}</Text>
                    <Text style={styles.courseDetailsAbsenceNumberLabel}>{t('lesson.registeredAbsences')}</Text>
                </View>
                <View style={styles.courseDetailsAbsenceLimitBox}>
                    <Text style={styles.courseDetailsAbsenceLimitValue}>{maxAbsences === null ? '-' : `${maxAbsences}`}</Text>
                    <Text style={styles.courseDetailsAbsenceNumberLabel}>{t('lesson.hourLimit')}</Text>
                </View>
            </View>

            <View style={styles.courseDetailsAbsenceTrack}>
                <View style={[styles.courseDetailsAbsenceFill, status.tone === 'alert' ? styles.courseDetailsAbsenceFillAlert : status.tone === 'warning' ? styles.courseDetailsAbsenceFillWarning : styles.courseDetailsAbsenceFillOk, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.courseDetailsAbsenceDescription}>{status.description}</Text>
        </View>
    );
}

function getValidatedMee(course: CourseCard): { numericGradeCount: number; value: number | null } {
    const numericGrades = course.evaluationItems
        .map((evaluation) => parseGrade(evaluation.score))
        .filter((score): score is number => score !== null);

    if (numericGrades.length < 2) {
        return {
            numericGradeCount: numericGrades.length,
            value: null
        };
    }

    return {
        numericGradeCount: numericGrades.length,
        value: parseGrade(course.exerciseAverage)
    };
}

function buildGradeState(course: CourseCard, frequency: number | null, t: Translate): {
    color: string;
    details: Array<{ label: string; value: string }>;
    label: string;
    tone: 'danger' | 'neutral' | 'success' | 'warning';
    value: string;
} {
    const meeState = getValidatedMee(course);
    const mee = meeState.value;
    const pf = parseGrade(course.finalExam);
    const providedFinalGrade = parseGrade(course.finalGrade);
    const computedFinalGrade = mee !== null && pf !== null ? ((2 * mee) + pf) / 3 : null;
    const finalGrade = computedFinalGrade ?? providedFinalGrade;
    const hasEnoughPresence = frequency === null || frequency >= 75;
    const statusApproved = isApprovedStatus(course.status);
    const needsFinalGrade = mee !== null && mee < 8 && pf === null && !statusApproved;
    const requiredFinalExam = mee === null ? null : Math.max(0, 15 - (mee * 2));
    const details: Array<{ label: string; value: string }> = [];

    if (mee !== null) details.push({ label: 'MEE', value: mee.toFixed(1) });
    if (pf !== null) details.push({ label: 'PF', value: pf.toFixed(1) });
    if (finalGrade !== null) details.push({ label: 'MF', value: finalGrade.toFixed(1) });
    if (needsFinalGrade && requiredFinalExam !== null) details.push({ label: t('lesson.finalGradeNeeded'), value: requiredFinalExam > 10 ? '> 10.0' : requiredFinalExam.toFixed(1) });

    if (mee !== null && mee >= 8 && hasEnoughPresence && pf === null) {
        return {
            color: '#003215',
            details,
            label: t('lesson.gradeStatePfWaived'),
            tone: 'success',
            value: mee.toFixed(1)
        };
    }

    if (finalGrade !== null) {
        const approved = finalGrade >= 5 && hasEnoughPresence;
        return {
            color: approved ? '#003215' : '#ba1a1a',
            details,
            label: t('lesson.gradeStateFinalAverage'),
            tone: approved ? 'success' : 'danger',
            value: finalGrade.toFixed(1)
        };
    }

    if (mee !== null) {
        const impossibleFinal = requiredFinalExam !== null && requiredFinalExam > 10;
        return {
            color: impossibleFinal ? '#ba1a1a' : '#7b5800',
            details,
            label: needsFinalGrade ? t('lesson.gradeStatePartialGrade') : 'MEE',
            tone: impossibleFinal ? 'danger' : 'warning',
            value: mee.toFixed(1)
        };
    }

    return {
        color: '#404941',
        details,
        label: meeState.numericGradeCount === 0 ? t('lesson.gradeStateNoGrade') : t('lesson.gradeStateWaitingGrades'),
        tone: 'neutral',
        value: 'S/N'
    };
}

function buildFinalExamStatus(course: CourseCard, frequency: number | null, t: Translate): {
    description: string;
    iconColor: string;
    metrics: Array<{ label: string; value: string }>;
    title: string;
    tone: 'danger' | 'success' | 'warning';
} {
    const meeState = getValidatedMee(course);
    const mee = meeState.value;
    const pf = parseGrade(course.finalExam);
    const providedFinalGrade = parseGrade(course.finalGrade);
    const computedFinalGrade = mee !== null && pf !== null ? ((2 * mee) + pf) / 3 : null;
    const finalGrade = computedFinalGrade ?? providedFinalGrade;
    const hasEnoughPresence = frequency === null || frequency >= 75;
    const metrics: Array<{ label: string; value: string }> = [
        { label: 'MEE', value: mee === null ? 'S/N' : mee.toFixed(1) },
        { label: t('nav.grades'), value: `${meeState.numericGradeCount}/2` },
        { label: t('lesson.frequency'), value: frequency === null ? '-' : `${frequency}%` }
    ];

    if (!hasEnoughPresence) {
        return {
            description: t('lesson.finalExamFreqBelow'),
            iconColor: '#ba1a1a',
            metrics: [...metrics, { label: t('lesson.minimum'), value: '75%' }],
            title: t('lesson.finalExamAbsenceRiskTitle'),
            tone: 'danger'
        };
    }

    if (mee === null) {
        return {
            description: meeState.numericGradeCount === 0 ? t('lesson.finalExamNoGrades') : t('lesson.finalExamNeedTwoGrades'),
            iconColor: '#7b5800',
            metrics,
            title: t('lesson.finalExamUndefinedTitle'),
            tone: 'warning'
        };
    }

    if (pf !== null || finalGrade !== null) {
        const approved = finalGrade !== null && finalGrade >= 5;
        return {
            description: approved ? t('lesson.finalExamApprovedDescription') : t('lesson.finalExamFailedDescription'),
            iconColor: approved ? '#003215' : '#ba1a1a',
            metrics: [...metrics, { label: 'PF', value: pf === null ? '-' : pf.toFixed(1) }, { label: 'MF', value: finalGrade === null ? '-' : finalGrade.toFixed(1) }],
            title: approved ? t('lesson.finalExamPassTitle') : t('lesson.finalExamFailTitle'),
            tone: approved ? 'success' : 'danger'
        };
    }

    if (mee >= 8) {
        return {
            description: t('lesson.finalExamMinFrequencyDescription'),
            iconColor: '#003215',
            metrics: [...metrics, { label: t('lesson.finalGradeNeeded'), value: t('lesson.finalExamWaived') }],
            title: t('lesson.finalExamApprovedNoPfTitle'),
            tone: 'success'
        };
    }

    const requiredFinalExam = 15 - (mee * 2);
    const impossible = requiredFinalExam > 10;

    return {
        description: impossible ? t('lesson.finalExamImpossibleDescription') : t('lesson.finalExamFormulaDescription', { grade: Math.max(requiredFinalExam, 0).toFixed(1) }),
        iconColor: impossible ? '#ba1a1a' : '#7b5800',
        metrics: [...metrics, { label: t('lesson.finalGradeNeeded'), value: impossible ? '> 10.0' : Math.max(requiredFinalExam, 0).toFixed(1) }],
        title: impossible ? t('lesson.finalExamImpossibleTitle') : t('lesson.finalExamNeededTitle'),
        tone: impossible ? 'danger' : 'warning'
    };
}

function buildAbsenceStatus(course: CourseCard, frequency: number | null, t: Translate): {
    description: string;
    label: string;
    tone: 'alert' | 'ok' | 'warning';
} {
    const attendance = course.attendance;
    const absencesHours = attendance?.absences_hours ?? parseHours(course.absences);
    const maxAbsences = attendance?.max_absences_allowed ?? null;

    if (attendance?.is_absence_risk === true || frequency !== null && frequency < 75 || maxAbsences !== null && absencesHours > maxAbsences) {
        return {
            description: maxAbsences === null ? t('lesson.absenceBelowMin') : t('lesson.absenceLimitExceeded', { absences: absencesHours, max: maxAbsences }),
            label: t('lesson.absenceAlert'),
            tone: 'alert'
        };
    }

    if (frequency !== null && frequency < 80 || maxAbsences !== null && absencesHours >= Math.ceil(maxAbsences * 0.75)) {
        return {
            description: maxAbsences === null ? t('lesson.absenceFrequencyWarning', { frequency: frequency ?? '-' }) : t('lesson.absenceNearLimit', { absences: absencesHours, max: maxAbsences }),
            label: t('lesson.absenceWarning'),
            tone: 'warning'
        };
    }

    return {
        description: frequency === null ? t('lesson.absenceUnavailable') : t('lesson.absenceOk', { frequency }),
        label: t('lesson.absenceAllGood'),
        tone: 'ok'
    };
}

function parseAdmissionYear(value: string | undefined, fallback: number): number {
    const match = value?.match(/\b(19|20)\d{2}\b/);
    const parsed = match ? Number(match[0]) : fallback;
    return Number.isFinite(parsed) ? parsed : fallback;
}

function buildAttendanceSummary(
    currentAttendance: AttendanceSummary | null,
    workloadHours: number | null,
    absences: string
): AttendanceSummary | null {
    if (currentAttendance && currentAttendance.source === 'computed') {
        return currentAttendance;
    }

    if (!workloadHours || workloadHours <= 0) {
        return currentAttendance;
    }

    const absencesHours = parseHours(absences);
    const maxAbsencesAllowed = Math.floor(workloadHours * 0.25);
    const minimumPresenceHours = workloadHours - maxAbsencesAllowed;
    const presenceHours = Math.max(workloadHours - absencesHours, 0);

    return {
        workload_hours: workloadHours,
        absences_hours: absencesHours,
        max_absences_allowed: maxAbsencesAllowed,
        minimum_presence_hours: minimumPresenceHours,
        presence_hours: presenceHours,
        presence_percent: Math.max(0, Math.min(100, Math.round((presenceHours / workloadHours) * 100))),
        is_absence_risk: absencesHours > maxAbsencesAllowed,
        source: 'computed'
    };
}

function parseHours(value: string): number {
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : 0;
}

function parseEvaluationItems(value: string, t: Translate): Array<{ score: string; weight: string }> {
    if (!value.trim()) return [];

    return value.split('|').map((part, index) => {
        const [weight, score] = part.split(':').map((item) => item.trim());
        return {
            weight: weight || t('lesson.evaluationFallback', { count: index + 1 }),
            score: score || ''
        };
    });
}

function getCurrentLessonPreview(items: Workspace['lessonPlan'], count: number): Workspace['lessonPlan'] {
    const sorted = sortLessonsByDate(items);
    const today = startOfDay(new Date());
    const nextIndex = sorted.findIndex((item) => {
        const date = parseLessonDate(item.date);
        return date !== null && date.getTime() >= today.getTime();
    });

    if (nextIndex >= 0) return sorted.slice(nextIndex, nextIndex + count);
    return sorted.slice(Math.max(sorted.length - count, 0));
}

function splitLessonsByCurrentDate(items: Workspace['lessonPlan']) {
    const sorted = sortLessonsByDate(items);
    const today = startOfDay(new Date());
    const upcoming: Workspace['lessonPlan'] = [];
    const taught: Workspace['lessonPlan'] = [];

    for (const item of sorted) {
        const date = parseLessonDate(item.date);
        if (date && date.getTime() >= today.getTime()) {
            upcoming.push(item);
        } else {
            taught.push(item);
        }
    }

    return {
        upcoming,
        taught: taught.reverse()
    };
}

function buildContentProgress(items: Workspace['lessonPlan']) {
    const grouped = splitLessonsByCurrentDate(items);
    const totalHours = items.reduce((total, item) => total + parseWorkloadHours(item.workload), 0);
    const doneHours = grouped.taught.reduce((total, item) => total + parseWorkloadHours(item.workload), 0);
    const fallbackTotal = totalHours > 0 ? totalHours : items.length;
    const fallbackDone = totalHours > 0 ? doneHours : grouped.taught.length;

    return {
        doneHours: fallbackDone,
        totalHours: fallbackTotal,
        percent: fallbackTotal > 0 ? Math.min(100, Math.round((fallbackDone / fallbackTotal) * 100)) : 0
    };
}

function sortLessonsByDate(items: Workspace['lessonPlan']): Workspace['lessonPlan'] {
    return [...items].sort((a, b) => {
        const aDate = parseLessonDate(a.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDate = parseLessonDate(b.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
    });
}

function parseLessonDate(value: string): Date | null {
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const yearValue = Number(match[3]);
    const year = yearValue < 100 ? 2000 + yearValue : yearValue;
    const date = new Date(year, month, day);

    return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function startOfDay(date: Date): Date {
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);
    return current;
}

function parseWorkloadHours(value: string | number): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : 0;
}

function formatWorkloadLabel(value: string | number, t: Translate): string {
    const hours = parseWorkloadHours(value);
    return hours > 0 ? t('lesson.workloadHours', { hours }) : t('lesson.workloadUnknown');
}

function formatLessonDateLabel(value: string, status: 'taught' | 'upcoming', t: Translate): string {
    if (!value) return status === 'upcoming' ? t('lesson.upcomingClass') : t('lesson.taughtClass');
    return status === 'upcoming' ? t('lesson.upcomingClassWithDate', { date: value }) : value;
}

function isPracticalLesson(item: Workspace['lessonPlan'][number]): boolean {
    return item.type.toLocaleLowerCase('pt-BR').includes('prat');
}

function filterLessonItems(items: Workspace['lessonPlan'], filter: 'all' | 'practical' | 'theoretical'): Workspace['lessonPlan'] {
    if (filter === 'all') return items;
    if (filter === 'practical') return items.filter((item) => isPracticalLesson(item));
    return items.filter((item) => !isPracticalLesson(item));
}

function formatCourseSchedule(items: Workspace['schedule'], t: Translate): string {
    if (items.length === 0) return t('lesson.scheduleUnknown');

    const byTime = new Map<string, string[]>();
    for (const item of items) {
        const time = `${trimTime(item.start_time)} - ${trimTime(item.end_time)}`;
        byTime.set(time, [...(byTime.get(time) || []), formatWeekdayShort(item.weekday, t)]);
    }

    return Array.from(byTime.entries())
        .map(([time, days]) => `${uniqueValues(days).join('/')} ${time}`)
        .join(' | ');
}

function formatWeekdayShort(value: string, t: Translate): string {
    const map: Record<string, string> = {
        Monday: t('weekday.mondayShort'),
        Tuesday: t('weekday.tuesdayShort'),
        Wednesday: t('weekday.wednesdayShort'),
        Thursday: t('weekday.thursdayShort'),
        Friday: t('weekday.fridayShort'),
        Saturday: t('weekday.saturdayShort'),
        Sunday: t('weekday.sundayShort')
    };
    return map[value] || value;
}

function trimTime(value: string): string {
    const match = value.match(/\d{1,2}:\d{2}/);
    return match ? match[0] : value;
}

function uniqueValues(values: string[]): string[] {
    return Array.from(new Set(values));
}

function formatPeriodOption(period: string, selectedYear: string, current: Workspace['currentGradesInput'], t: Translate): string {
    const label = period === '1' ? t('lesson.firstSemester') : t('lesson.secondSemester');
    return selectedYear === current.year && period === current.period ? `${label} (${t('lesson.currentTag')})` : label;
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

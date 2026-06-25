import { Pressable, Text, View } from 'react-native';
import { BookOpen, CalendarDays, CheckCircle2, ClipboardList, FileText, GraduationCap, Star, TrendingUp } from 'lucide-react-native';
import { colors } from '@/presentation/design-system';
import { useLanguage } from '@/presentation/i18n/language-provider';
import type { Workspace } from '@/presentation/views/workspace.types';
import { SkeletonBlock } from '@/presentation/views/components';
import { buildWeekMap, getNextScheduleClass, groupScheduleByDay, isApprovedStatus, parseAbsences, parseGrade, toTitleName, useResponsiveLayout } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function DashboardPage({ workspace }: { workspace: Workspace }) {
    const layout = useResponsiveLayout();
    const { t } = useLanguage();
    const { grades, isLoading, lessonPlanSubjects, profile, schedule } = workspace;
    const groupedSchedule = groupScheduleByDay(schedule);
    const weekMap = buildWeekMap(groupedSchedule, t);
    const nextClass = getNextScheduleClass(schedule, t);
    const numericGrades = grades.map((grade) => parseGrade(grade.final_grade)).filter((grade): grade is number => grade !== null);
    const averageNumber = numericGrades.length ? numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length : null;
    const approved = grades.filter((grade) => isApprovedStatus(grade.status)).length;
    const totalAbsences = grades.reduce((sum, grade) => sum + parseAbsences(grade.absences), 0);
    const subjectCount = Math.max(lessonPlanSubjects.length, grades.length, new Set(schedule.map((item) => item.code)).size);
    const firstName = profile?.personal?.full_name ? toTitleName(profile.personal.full_name).split(/\s+/)[0] : t('home.studentFallback');
    const courseProgress = lessonPlanSubjects.length > 0 && grades.length > 0 ? Math.min(99, Math.round((approved / lessonPlanSubjects.length) * 100)) : null;
    const pendingSubjects = lessonPlanSubjects.length > 0 ? Math.max(lessonPlanSubjects.length - approved, 0) : null;
    const computedFrequencies = grades
        .map((grade) => grade.attendance?.presence_percent)
        .filter((frequency): frequency is number => typeof frequency === 'number');
    const frequency = computedFrequencies.length ? Math.round(computedFrequencies.reduce((sum, value) => sum + value, 0) / computedFrequencies.length) : null;
    const weakestGrades = grades
        .map((grade) => ({ grade, parsedFinal: parseGrade(grade.final_grade) }))
        .filter((entry): entry is { grade: Workspace['grades'][number]; parsedFinal: number } => entry.parsedFinal !== null)
        .sort((a, b) => a.parsedFinal - b.parsedFinal)
        .slice(0, 3);
    const shortcuts = [
        { label: t('nav.grades'), icon: Star, action: () => workspace.openTab('grades'), tone: styles.homeShortcutTonePrimary },
        { label: t('nav.schedule'), icon: CalendarDays, action: () => workspace.openTab('schedule'), tone: styles.homeShortcutToneSecondary },
        { label: t('nav.lessonPlan'), icon: ClipboardList, action: () => workspace.openTab('lessonPlan'), tone: styles.homeShortcutToneNeutral },
        { label: t('nav.profile'), icon: FileText, action: () => workspace.openTab('profile'), tone: styles.homeShortcutToneNeutral }
    ];

    if (isLoading && !profile && schedule.length === 0 && grades.length === 0) return <DashboardSkeleton />;

    return (
        <View style={styles.homeScreenStack}>
            <View style={styles.homeGreeting}>
                <Text style={styles.homeGreetingTitle}>{t('home.greetingTitle', { name: firstName })}</Text>
                <Text style={styles.homeGreetingText}>{profile?.academic?.course || t('home.welcomeFallback')}</Text>
            </View>

            <View style={styles.homeSection}>
                <View style={styles.homeSectionHeader}>
                    <Text style={styles.homeSectionTitle}>{nextClass?.isHappening ? t('home.classInProgress') : t('home.nextClass')}</Text>
                    <Pressable onPress={() => workspace.openTab('schedule')}>
                        <Text style={styles.homeSectionAction}>{t('home.viewAll')}</Text>
                    </Pressable>
                </View>
                <View style={styles.homeNextClassCard}>
                    <BookOpen color="rgba(255,255,255,0.12)" size={118} style={styles.homeNextClassWatermark} />
                    <View style={styles.homeNextClassTop}>
                        <View style={styles.homeNextClassBody}>
                            <Text numberOfLines={1} style={styles.homeNextClassCode}>{nextClass?.item.code || t('home.scheduleCodeFallback')}</Text>
                            <Text numberOfLines={2} style={styles.homeNextClassTitle}>{nextClass?.item.subject || t('home.noClassLoaded')}</Text>
                            <Text style={styles.homeNextClassText}>{nextClass ? `${nextClass.label} - ${t('home.classGroup', { group: nextClass.item.class_identifier || '-' })}` : t('home.updateSchedule')}</Text>
                        </View>
                        <View style={styles.homeTimePill}>
                            <Text style={styles.homeTimePillText}>{nextClass ? `${nextClass.item.start_time} - ${nextClass.item.end_time}` : '--:--'}</Text>
                        </View>
                    </View>
                    <View style={styles.homeTeacherRow}>
                        <View style={styles.homeTeacherAvatar}>
                            <GraduationCap color={colors.brandMuted} size={20} />
                        </View>
                        <View style={styles.homeTeacherText}>
                            <Text numberOfLines={1} style={styles.homeTeacherName}>{profile?.academic?.course || t('home.courseUnknown')}</Text>
                            <Text numberOfLines={1} style={styles.homeTeacherMeta}>{profile?.academic?.enrollment_number || t('home.enrollmentUnknown')}</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.homeSection}>
                <Text style={styles.homeSectionTitle}>{t('home.semesterSummary')}</Text>
                <View style={[styles.homeBentoGrid, layout.isTablet ? styles.homeBentoGridWide : null]}>
                    <View style={[styles.homeBentoCard, styles.homeBentoHalf]}>
                        <View style={styles.homeBentoLabelRow}>
                            <Star color={colors.brand} fill={colors.brand} size={17} />
                            <Text style={styles.homeBentoLabel}>CRA</Text>
                        </View>
                        <Text style={styles.homeBentoValue}>{averageNumber === null ? '-' : averageNumber.toFixed(2)}</Text>
                        <Text style={styles.homeBentoHint}>{t('home.subjectCount', { count: subjectCount })}</Text>
                    </View>

                    <View style={[styles.homeBentoCard, styles.homeBentoHalf]}>
                        <View style={styles.homeBentoLabelRow}>
                            <CheckCircle2 color={colors.warning} fill={colors.warning} size={17} />
                            <Text style={styles.homeBentoLabel}>{t('home.frequency')}</Text>
                        </View>
                        <Text style={styles.homeBentoValue}>{frequency === null ? '-' : `${frequency}%`}</Text>
                        <View style={styles.homeProgressTrack}>
                            <View style={[styles.homeProgressFillSecondary, { width: `${frequency ?? 0}%` }]} />
                        </View>
                    </View>

                    <View style={styles.homeBentoWide}>
                        <View style={styles.homeProgressHeader}>
                            <Text style={styles.homeBentoLabel}>{t('home.courseProgress')}</Text>
                            <Text style={styles.homeProgressValue}>{courseProgress === null ? '-' : `${courseProgress}%`}</Text>
                        </View>
                        <View style={styles.homeProgressTrack}>
                            <View style={[styles.homeProgressFillPrimary, { width: `${courseProgress ?? 0}%` }]} />
                        </View>
                        <Text style={styles.homeBentoHint}>{pendingSubjects === null ? t('home.coursePlanPending') : t('home.pendingSubjects', { count: pendingSubjects })}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.homeSection}>
                <Text style={styles.homeSectionTitle}>{t('home.quickAccess')}</Text>
                <View style={styles.homeShortcutRow}>
                    {shortcuts.map((shortcut) => {
                        const Icon = shortcut.icon;
                        return (
                            <Pressable key={shortcut.label} onPress={shortcut.action} style={styles.homeShortcutCard}>
                                <View style={[styles.homeShortcutIcon, shortcut.tone]}>
                                    <Icon color={shortcut.tone === styles.homeShortcutToneSecondary ? colors.warning : shortcut.tone === styles.homeShortcutTonePrimary ? colors.brand : colors.textMuted} size={22} />
                                </View>
                                <Text numberOfLines={1} style={styles.homeShortcutText}>{shortcut.label}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            <View style={[styles.homeInsightGrid, layout.isTablet ? styles.twoColumnGridWide : null]}>
                <View style={[styles.panel, layout.isTablet ? styles.gridPanel : null]}>
                    <View style={styles.homeInsightHeader}>
                        <TrendingUp color={colors.brand} size={18} />
                        <Text style={styles.panelTitle}>{t('home.academicSituation')}</Text>
                    </View>
                    <View style={styles.summaryRows}>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('home.subjectsApproved')}</Text><Text style={styles.summaryValue}>{grades.length ? `${approved}/${grades.length}` : '-'}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('home.registeredAbsences')}</Text><Text style={styles.summaryValue}>{totalAbsences}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('home.classDays')}</Text><Text style={styles.summaryValue}>{weekMap.filter((day) => day.items.length > 0).length}</Text></View>
                    </View>
                </View>

                <View style={[styles.panel, layout.isTablet ? styles.gridPanel : null]}>
                    <Text style={styles.panelTitle}>{t('home.attentionPoints')}</Text>
                    <View style={styles.listStack}>
                        {weakestGrades.length === 0 ? <Text style={styles.panelDescription}>{t('home.noGradesLoaded')}</Text> : null}
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

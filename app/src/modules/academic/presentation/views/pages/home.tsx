import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Clock3, GraduationCap, Sparkles, Star } from 'lucide-react-native';
import { colors, gradients } from '@/shared/design-system';
import { useLanguage } from '@/shared/i18n/language-provider';
import type { Workspace } from '@/modules/academic/presentation/views/workspace.types';
import { ProgressRing, SkeletonBlock, SkeletonCircle } from '@/modules/academic/presentation/views/components';
import { buildWeekMap, formatGrade, getNextScheduleClass, groupScheduleByDay, isApprovedStatus, parseAbsences, parseGrade, toSubjectTitle, toTitleName, useCountUp } from '@/modules/academic/presentation/views/workspace.utils';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';

// A slow, occasional light sweep across the AI CTA — the kind of "premium
// card" shine seen on subscription upsells. Runs, pauses, repeats, using the
// same manual-reset loop as the skeleton shimmer (Animated.loop's own reset
// was unreliable on this setup — see ui.tsx).
function useShineSweep(pauseMs = 2600, durationMs = 1200): Animated.Value {
    const progress = useRef(new Animated.Value(-1)).current;

    useEffect(() => {
        let isActive = true;
        let pauseTimer: ReturnType<typeof setTimeout>;

        const runCycle = () => {
            progress.setValue(-1);
            Animated.timing(progress, {
                toValue: 1,
                duration: durationMs,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false
            }).start(({ finished }) => {
                if (isActive && finished) pauseTimer = setTimeout(runCycle, pauseMs);
            });
        };

        runCycle();
        return () => {
            isActive = false;
            clearTimeout(pauseTimer);
            progress.stopAnimation();
        };
    }, [progress, pauseMs, durationMs]);

    return progress;
}

export function DashboardPage({ workspace }: { workspace: Workspace }) {
    const { t } = useLanguage();
    const router = useRouter();
    const { grades, isInitialDataLoading, isLoading, lessonPlanSubjects, profile, schedule } = workspace;
    const groupedSchedule = groupScheduleByDay(schedule);
    const weekMap = buildWeekMap(groupedSchedule, t);
    const nextClass = getNextScheduleClass(schedule, t);
    const numericGrades = grades.map((grade) => parseGrade(grade.final_grade)).filter((grade): grade is number => grade !== null);
    const averageNumber = numericGrades.length ? numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length : null;
    const approved = grades.filter((grade) => isApprovedStatus(grade.status)).length;
    const totalAbsences = grades.reduce((sum, grade) => sum + parseAbsences(grade.absences), 0);
    const subjectCount = Math.max(lessonPlanSubjects.length, grades.length, new Set(schedule.map((item) => item.code)).size);
    const classDaysCount = weekMap.filter((day) => day.items.length > 0).length;
    const studentName = profile?.personal?.full_name ? toTitleName(profile.personal.full_name) : t('home.studentFallback');
    const firstName = studentName.split(/\s+/)[0];
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

    // These count up (and the bars/ring grow) whenever their target changes —
    // most visibly right as the skeleton swaps out for real data.
    const animatedAverage = useCountUp(averageNumber);
    const animatedFrequency = useCountUp(frequency);
    const animatedAbsences = useCountUp(totalAbsences);
    const animatedCourseProgress = useCountUp(courseProgress);
    const animatedApproved = useCountUp(approved);
    const animatedPending = useCountUp(pendingSubjects);
    const shineProgress = useShineSweep();

    if (isInitialDataLoading || (isLoading && !profile && schedule.length === 0 && grades.length === 0)) return <DashboardSkeleton />;

    return (
        <View style={styles.homeScreenStack}>
            <View style={styles.homeHero}>
                <View style={styles.homeHeroTextStack}>
                    <Text numberOfLines={1} style={styles.homeGreetingTitle}>{t('home.greeting', { name: firstName })}</Text>
                    <Text numberOfLines={1} style={styles.homeGreetingText}>{profile?.academic?.course || t('home.welcomeFallback')}</Text>
                </View>
            </View>

            <View style={styles.homeSection}>
                <View style={styles.homeSectionHeader}>
                    <Text style={styles.homeSectionTitle}>{nextClass?.isHappening ? t('home.classInProgress') : t('home.nextClass')}</Text>
                    <Pressable onPress={() => router.push('/schedule')} style={({ pressed }) => (pressed ? styles.pressedFeedback : null)}>
                        <Text style={styles.homeSectionAction}>{t('home.viewAll')}</Text>
                    </Pressable>
                </View>
                <View style={styles.homeNextClassCard}>
                    <BookOpen color="rgba(255,255,255,0.12)" size={118} style={styles.homeNextClassWatermark} />
                    <View style={styles.homeNextClassTop}>
                        <View style={styles.homeNextClassBody}>
                            <Text numberOfLines={1} style={styles.homeNextClassCode}>{nextClass?.item.code || t('home.scheduleCodeFallback')}</Text>
                            <Text numberOfLines={2} style={styles.homeNextClassTitle}>{nextClass ? toSubjectTitle(nextClass.item.subject) : t('home.noClassLoaded')}</Text>
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

            <View style={styles.homeKpiRow}>
                <View style={styles.homeKpiCard}>
                    <View style={[styles.homeKpiAccent, { backgroundColor: colors.brand }]} />
                    <View style={styles.homeKpiTopRow}>
                        <View style={[styles.homeKpiIconBadge, styles.homeKpiTonePrimary]}>
                            <Star color={colors.brand} fill={colors.brand} size={11} />
                        </View>
                        <Text numberOfLines={1} style={styles.homeKpiLabel}>CRA</Text>
                    </View>
                    <Text style={styles.homeKpiValue}>{animatedAverage === null ? '-' : formatGrade(animatedAverage)}</Text>
                    <Text numberOfLines={1} style={styles.homeKpiHint}>{t('home.subjectCount', { count: subjectCount })}</Text>
                </View>

                <View style={styles.homeKpiCard}>
                    <View style={[styles.homeKpiAccent, { backgroundColor: colors.warning }]} />
                    <View style={styles.homeKpiTopRow}>
                        <View style={[styles.homeKpiIconBadge, styles.homeKpiToneWarning]}>
                            <CheckCircle2 color={colors.warning} fill={colors.warning} size={11} />
                        </View>
                        <Text numberOfLines={1} style={styles.homeKpiLabel}>{t('home.frequency')}</Text>
                    </View>
                    <Text style={styles.homeKpiValue}>{animatedFrequency === null ? '-' : `${Math.round(animatedFrequency)}%`}</Text>
                    <View style={styles.homeProgressTrack}>
                        <View style={[styles.homeProgressFillWarning, { width: `${animatedFrequency ?? 0}%` }]} />
                    </View>
                </View>

                <View style={styles.homeKpiCard}>
                    <View style={[styles.homeKpiAccent, { backgroundColor: colors.danger }]} />
                    <View style={styles.homeKpiTopRow}>
                        <View style={[styles.homeKpiIconBadge, styles.homeKpiToneDanger]}>
                            <AlertTriangle color={colors.danger} size={11} />
                        </View>
                        <Text numberOfLines={1} style={styles.homeKpiLabel}>{t('home.registeredAbsences')}</Text>
                    </View>
                    <Text style={styles.homeKpiValue}>{Math.round(animatedAbsences ?? 0)}</Text>
                    <Text numberOfLines={1} style={styles.homeKpiHint}>{classDaysCount} {t('home.classDays').toLowerCase()}</Text>
                </View>
            </View>

            <View style={styles.homeSection}>
                <Text style={styles.homeSectionTitle}>{t('home.courseProgress')}</Text>
                <View style={styles.homeProgressCard}>
                    <ProgressRing color={colors.brand} percent={courseProgress ?? 0} size={100} strokeWidth={10}>
                        <Text numberOfLines={1} style={styles.homeProgressRingValue}>{animatedCourseProgress === null ? '-' : `${Math.round(animatedCourseProgress)}%`}</Text>
                    </ProgressRing>
                    <View style={styles.homeProgressTextStack}>
                        <View style={styles.homeStatRow}>
                            <View style={[styles.homeStatIconBadge, styles.homeKpiTonePrimary]}>
                                <CheckCircle2 color={colors.brand} size={18} />
                            </View>
                            <View style={styles.homeStatTextStack}>
                                <Text style={styles.homeStatValue}>{grades.length ? `${Math.round(animatedApproved ?? 0)}/${grades.length}` : '-'}</Text>
                                <Text style={styles.homeStatLabel}>{t('home.subjectsApproved')}</Text>
                            </View>
                        </View>
                        <View style={styles.homeStatRow}>
                            <View style={[styles.homeStatIconBadge, styles.homeKpiToneWarning]}>
                                <Clock3 color={colors.warning} size={18} />
                            </View>
                            <View style={styles.homeStatTextStack}>
                                <Text style={styles.homeStatValue}>{animatedPending === null ? '-' : Math.round(animatedPending)}</Text>
                                <Text numberOfLines={1} style={styles.homeStatLabel}>{pendingSubjects === null ? t('home.coursePlanPending') : t('home.pendingSubjects', { count: pendingSubjects })}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            <Pressable onPress={() => router.push('/ai')} style={({ pressed }) => [styles.homeAiCta, pressed ? styles.pressedFeedback : null]}>
                <LinearGradient colors={gradients.brand} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.homeAiCtaGradient}>
                    <Sparkles color="rgba(255,255,255,0.14)" size={140} style={styles.homeAiCtaGlow} />
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.homeAiCtaShine,
                            {
                                left: shineProgress.interpolate({ inputRange: [-1, 1], outputRange: ['-35%', '115%'] }),
                                opacity: shineProgress.interpolate({ inputRange: [-1, -0.6, 0, 0.6, 1], outputRange: [0, 0.9, 1, 0.9, 0] })
                            }
                        ]}
                    />
                    <View style={styles.homeAiCtaIconBadge}>
                        <Sparkles color={colors.inverseText} size={24} />
                    </View>
                    <View style={styles.homeAiCtaTextStack}>
                        <View style={styles.homeAiCtaEyebrowRow}>
                            <Text style={styles.homeAiCtaEyebrow}>{t('home.aiCtaEyebrow')}</Text>
                            <View style={styles.homeAiCtaProBadge}>
                                <Text style={styles.homeAiCtaProBadgeText}>PRO</Text>
                            </View>
                        </View>
                        <Text numberOfLines={1} style={styles.homeAiCtaTitle}>{t('home.aiCtaTitle')}</Text>
                        <Text numberOfLines={2} style={styles.homeAiCtaText}>{t('home.aiCtaText')}</Text>
                    </View>
                    <View style={styles.homeAiCtaArrow}>
                        <ArrowRight color={colors.inverseText} size={18} />
                    </View>
                </LinearGradient>
            </Pressable>

            <View style={styles.homeSection}>
                <View style={styles.homeInsightHeader}>
                    <AlertTriangle color={colors.danger} size={18} />
                    <Text style={styles.homeSectionTitle}>{t('home.attentionPoints')}</Text>
                </View>
                <View style={[styles.panel, styles.listStack]}>
                    {weakestGrades.length === 0 ? <Text style={styles.panelDescription}>{t('home.noGradesLoaded')}</Text> : null}
                    {weakestGrades.map(({ grade, parsedFinal }) => {
                        const isDanger = parsedFinal < 5;
                        const isWarning = !isDanger && parsedFinal < 7;
                        return (
                            <View
                                key={`${grade.code}-${grade.subject}`}
                                style={[styles.attentionCard, isDanger ? styles.attentionCardDanger : isWarning ? styles.attentionCardWarning : null]}
                            >
                                <View style={styles.attentionCardRow}>
                                    <View style={[styles.attentionBadge, isDanger ? styles.homeKpiToneDanger : isWarning ? styles.homeKpiToneWarning : styles.homeKpiTonePrimary]}>
                                        <AlertTriangle color={isDanger ? colors.danger : isWarning ? colors.warning : colors.brand} size={16} />
                                    </View>
                                    <View style={styles.attentionCardBody}>
                                        <Text style={styles.smallCaps}>{grade.code}</Text>
                                        <Text numberOfLines={1} style={styles.attentionTitle}>{toSubjectTitle(grade.subject)}</Text>
                                    </View>
                                    <View style={[styles.attentionGradeBadge, isDanger ? styles.homeKpiToneDanger : isWarning ? styles.homeKpiToneWarning : styles.homeKpiTonePrimary]}>
                                        <Text style={styles.attentionGradeLabel}>MF</Text>
                                        <Text style={[styles.attentionGradeValue, isDanger ? styles.attentionTextDanger : isWarning ? styles.attentionTextWarning : null]}>{grade.final_grade || '-'}</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

function DashboardSkeleton() {
    return (
        <View style={styles.homeScreenStack}>
            <View style={styles.homeHero}>
                <View style={[styles.homeHeroTextStack, { gap: 6 }]}>
                    <SkeletonBlock height={26} style={{ width: '50%' }} />
                    <SkeletonBlock height={15} style={{ width: '65%' }} />
                </View>
            </View>

            <View style={styles.homeSection}>
                <View style={styles.homeSectionHeader}>
                    <SkeletonBlock height={16} style={{ width: 120 }} />
                    <SkeletonBlock height={14} style={{ width: 60 }} />
                </View>
                <View style={styles.homeNextClassCard}>
                    <View style={styles.homeNextClassTop}>
                        <View style={[styles.homeNextClassBody, { gap: 8 }]}>
                            <SkeletonBlock height={13} style={{ backgroundColor: 'rgba(255,255,255,0.16)', width: '35%' }} />
                            <SkeletonBlock height={20} style={{ backgroundColor: 'rgba(255,255,255,0.16)', width: '75%' }} />
                            <SkeletonBlock height={13} style={{ backgroundColor: 'rgba(255,255,255,0.16)', width: '55%' }} />
                        </View>
                        <SkeletonBlock height={32} style={{ backgroundColor: 'rgba(255,255,255,0.16)', width: 82 }} />
                    </View>
                    <View style={styles.homeTeacherRow}>
                        <SkeletonCircle size={36} style={{ backgroundColor: 'rgba(255,255,255,0.16)' }} />
                        <View style={[styles.homeTeacherText, { gap: 6 }]}>
                            <SkeletonBlock height={13} style={{ backgroundColor: 'rgba(255,255,255,0.16)', width: '60%' }} />
                            <SkeletonBlock height={12} style={{ backgroundColor: 'rgba(255,255,255,0.16)', width: '40%' }} />
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.homeKpiRow}>
                {[0, 1, 2].map((index) => (
                    <View key={index} style={[styles.homeKpiCard, { gap: 6 }]}>
                        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
                            <SkeletonCircle size={20} />
                            <SkeletonBlock height={10} style={{ width: '55%' }} />
                        </View>
                        <SkeletonBlock height={20} style={{ width: '45%' }} />
                        <SkeletonBlock height={9} style={{ width: '80%' }} />
                    </View>
                ))}
            </View>

            <View style={styles.homeSection}>
                <SkeletonBlock height={16} style={{ width: 150 }} />
                <View style={[styles.homeProgressCard, { gap: 16 }]}>
                    <SkeletonCircle size={100} />
                    <View style={[styles.homeProgressTextStack, { gap: 8 }]}>
                        <SkeletonBlock height={56} style={{ width: '100%' }} />
                        <SkeletonBlock height={56} style={{ width: '100%' }} />
                    </View>
                </View>
            </View>

            <View style={[styles.homeAiCta, { minHeight: 96 }]}>
                <SkeletonBlock height={96} style={{ width: '100%' }} />
            </View>

            <View style={styles.homeSection}>
                <SkeletonBlock height={16} style={{ width: 150 }} />
                <View style={[styles.panel, styles.listStack]}>
                    <SkeletonBlock height={64} />
                    <SkeletonBlock height={64} />
                </View>
            </View>
        </View>
    );
}

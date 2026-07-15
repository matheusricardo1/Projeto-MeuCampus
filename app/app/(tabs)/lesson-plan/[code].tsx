import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLanguage } from '@/shared/i18n/language-provider';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';
import { useLessonPlanCourses } from '@/modules/academic/presentation/hooks/use-lesson-plan-courses';
import { CourseDetailsScreen } from '@/modules/academic/presentation/views/pages/lesson-plan';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';

export default function CourseDetailsRoute() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const { t } = useLanguage();
    const router = useRouter();
    const workspace = useWorkspace();
    const courses = useLessonPlanCourses({
        grades: workspace.grades,
        items: workspace.lessonPlan,
        schedule: workspace.schedule,
        selectedSubjectCode: workspace.selectedLessonPlanSubjectCode,
        subjects: workspace.lessonPlanSubjects,
        t
    });
    const course = courses.find((candidate) => candidate.code === code) ?? null;

    useEffect(() => {
        if (code && code !== workspace.selectedLessonPlanSubjectCode) {
            void workspace.changeLessonPlanSubject(code);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code]);

    if (!course) return <View style={styles.flexScroll} />;

    return (
        <CourseDetailsScreen
            course={course}
            loading={workspace.isLessonPlanLoading && course.code === workspace.selectedLessonPlanSubjectCode}
            onBack={() => router.back()}
            onOpenFullContent={() => router.push(`/lesson-plan/${encodeURIComponent(course.code)}/content`)}
            semester={`${workspace.gradesInput.year}.${workspace.gradesInput.period}`}
            t={t}
        />
    );
}

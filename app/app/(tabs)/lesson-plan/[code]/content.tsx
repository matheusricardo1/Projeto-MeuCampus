import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLanguage } from '@/shared/i18n/language-provider';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';
import { useLessonPlanCourses } from '@/modules/academic/presentation/hooks/use-lesson-plan-courses';
import { CourseContentScreen } from '@/modules/academic/presentation/views/pages/lesson-plan';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';

export default function CourseContentRoute() {
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

    if (!course) return <View style={styles.flexScroll} />;

    return <CourseContentScreen course={course} onBack={() => router.back()} t={t} />;
}

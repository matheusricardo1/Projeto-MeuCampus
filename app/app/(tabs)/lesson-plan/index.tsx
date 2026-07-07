import { useEffect } from 'react';
import { LessonPlanListPage } from '@/modules/academic/presentation/views/pages/lesson-plan';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';

export default function LessonPlanRoute() {
    const workspace = useWorkspace();

    useEffect(() => {
        workspace.openTab('lessonPlan');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <LessonPlanListPage
            currentGradesInput={workspace.currentGradesInput}
            grades={workspace.grades}
            gradesInput={workspace.gradesInput}
            items={workspace.lessonPlan}
            loading={workspace.isLoading}
            onChangeGradesInput={workspace.changeGradesInputAndLoad}
            onRefreshSubjects={workspace.loadLessonPlanSubjects}
            profile={workspace.profile}
            schedule={workspace.schedule}
            selectedSubjectCode={workspace.selectedLessonPlanSubjectCode}
            subjects={workspace.lessonPlanSubjects}
        />
    );
}

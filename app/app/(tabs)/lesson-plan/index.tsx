import { useEffect } from 'react';
import { LessonPlanPage } from '@/modules/academic/presentation/views/pages/lesson-plan';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';
import { useTabsChrome } from '../_layout';

export default function LessonPlanRoute() {
    const workspace = useWorkspace();
    const chrome = useTabsChrome();

    useEffect(() => {
        workspace.openTab('lessonPlan');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <LessonPlanPage
            currentGradesInput={workspace.currentGradesInput}
            grades={workspace.grades}
            gradesInput={workspace.gradesInput}
            items={workspace.lessonPlan}
            loading={workspace.isLoading}
            onChangeGradesInput={workspace.changeGradesInputAndLoad}
            onChangeSubjectCode={workspace.changeLessonPlanSubject}
            onNavigateScreen={chrome.scrollToTop}
            onRefresh={workspace.loadLessonPlan}
            onRefreshSubjects={workspace.loadLessonPlanSubjects}
            profile={workspace.profile}
            schedule={workspace.schedule}
            selectedSubjectCode={workspace.selectedLessonPlanSubjectCode}
            subjects={workspace.lessonPlanSubjects}
        />
    );
}

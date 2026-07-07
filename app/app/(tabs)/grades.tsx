import { useEffect } from 'react';
import { GradesPage } from '@/modules/academic/presentation/views/pages/grades';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';

export default function GradesRoute() {
    const workspace = useWorkspace();

    useEffect(() => {
        workspace.openTab('grades');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <GradesPage grades={workspace.grades} input={workspace.gradesInput} loading={workspace.isLoading} onChange={workspace.setGradesInput} onRefresh={workspace.loadGrades} />;
}

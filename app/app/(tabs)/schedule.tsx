import { useEffect } from 'react';
import { SchedulePage } from '@/modules/academic/presentation/views/pages/schedule';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';

export default function ScheduleRoute() {
    const workspace = useWorkspace();

    useEffect(() => {
        workspace.openTab('schedule');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <SchedulePage schedule={workspace.schedule} onRefresh={workspace.loadSchedule} loading={workspace.isLoading} />;
}

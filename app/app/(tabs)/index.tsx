import { useEffect } from 'react';
import { DashboardPage } from '@/modules/academic/presentation/views/pages/home';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';

export default function HomeRoute() {
    const workspace = useWorkspace();

    useEffect(() => {
        workspace.openTab('home');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <DashboardPage workspace={workspace} />;
}

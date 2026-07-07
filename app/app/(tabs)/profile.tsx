import { useEffect } from 'react';
import { ProfilePage } from '@/modules/academic/presentation/views/pages/profile';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';

export default function ProfileRoute() {
    const workspace = useWorkspace();

    useEffect(() => {
        workspace.openTab('profile');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <ProfilePage profile={workspace.profile} onRefresh={workspace.loadProfile} onLogout={workspace.logout} loading={workspace.isLoading} />;
}

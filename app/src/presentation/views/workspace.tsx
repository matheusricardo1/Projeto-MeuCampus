import { useEffect, useRef } from 'react';
import { useEcampusWorkspace } from '@/presentation/hooks/use-ecampus-workspace';
import { WorkspaceShell } from '@/presentation/views/workspace-shell';

export function Workspace() {
    const workspace = useEcampusWorkspace();
    const didRestoreSession = useRef(false);

    useEffect(() => {
        if (didRestoreSession.current) return;
        didRestoreSession.current = true;
        void workspace.restoreSession();
    }, [workspace]);

    return <WorkspaceShell workspace={workspace} />;
}

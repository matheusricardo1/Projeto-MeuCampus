import { createContext, useContext, type ReactNode } from 'react';
import { useEcampusWorkspace } from '@/modules/academic/presentation/hooks/use-ecampus-workspace';
import type { Workspace } from '@/modules/academic/presentation/views/workspace.types';

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const workspace = useEcampusWorkspace();
    return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
    const workspace = useContext(WorkspaceContext);
    if (!workspace) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider.');
    }

    return workspace;
}

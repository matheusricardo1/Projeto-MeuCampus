import { CommunityPage } from '@/modules/community/presentation/views/community-page';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';

export default function CommunityRoute() {
    const workspace = useWorkspace();
    const authorName = workspace.profile?.personal.full_name?.trim() || 'Aluno(a) UFAM';

    return <CommunityPage authorName={authorName} />;
}

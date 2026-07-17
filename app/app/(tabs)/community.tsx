import { useRouter } from 'expo-router';
import { CommunityPage } from '@/modules/community/presentation/views/community-page';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';
import { useTabsChrome } from './_layout';

export default function CommunityRoute() {
    const workspace = useWorkspace();
    const router = useRouter();
    const { bottomNavInset } = useTabsChrome();
    const authorName = workspace.profile?.personal.full_name?.trim() || 'Aluno(a) UFAM';

    // Community isn't in the navbar — it opens from the Profile screen, so
    // "back" returns there (falls back to a direct navigation if there's no
    // history to pop, e.g. a deep link).
    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/profile');
    };

    return <CommunityPage authorName={authorName} bottomInset={bottomNavInset} onBack={goBack} />;
}

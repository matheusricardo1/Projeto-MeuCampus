import { LoginPage } from '@/modules/academic/presentation/views/pages/login';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';

export default function LoginRoute() {
    const workspace = useWorkspace();
    return <LoginPage workspace={workspace} />;
}

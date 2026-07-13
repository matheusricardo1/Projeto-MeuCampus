import { useEffect } from 'react';
import { ProfilePage } from '@/modules/academic/presentation/views/pages/profile';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';

export default function ProfileRoute() {
    const workspace = useWorkspace();

    useEffect(() => {
        workspace.openTab('profile');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <ProfilePage
            loading={workspace.isLoading}
            onCreateCardCheckout={workspace.createCardCheckout}
            onCreatePixCheckout={workspace.createPixCheckout}
            onGetBillingPlan={workspace.getBillingPlan}
            onGetCheckoutStatus={workspace.getCheckoutStatus}
            onGetMercadoPagoPublicKey={workspace.getMercadoPagoPublicKey}
            onLogout={workspace.logout}
            onRefresh={workspace.loadProfile}
            profile={workspace.profile}
        />
    );
}

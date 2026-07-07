import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Slot, useRouter, useSegments } from 'expo-router';
import { LanguageProvider } from '@/shared/i18n/language-provider';
import { WorkspaceProvider, useWorkspace } from '@/modules/academic/presentation/context/workspace-context';
import { BootPage } from '@/modules/academic/presentation/views/pages/boot';

/**
 * `100vh` on mobile browsers is measured against the largest possible
 * viewport (address bar collapsed), so anything anchored to it gets cut off
 * behind the address bar once it's expanded. `100dvh` tracks the *current*
 * visible viewport instead. Expo's web SPA shell (index.html) hardcodes
 * `height: 100%` via its own injected reset style, so this overrides it at
 * runtime rather than via +html.tsx, which Expo only honors in static/server
 * web output — this app intentionally stays in SPA ("single") output mode.
 */
function applyDynamicViewportHeightFix(): void {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const style = document.createElement('style');
    style.id = 'dvh-root-height-fix';
    style.textContent = 'html, body, #root { height: 100vh; height: 100dvh; }';
    document.head.appendChild(style);
}

export default function RootLayout() {
    useEffect(() => {
        applyDynamicViewportHeightFix();
    }, []);

    return (
        <LanguageProvider>
            <SafeAreaProvider>
                <StatusBar style="dark" />
                <WorkspaceProvider>
                    <AuthGate />
                </WorkspaceProvider>
            </SafeAreaProvider>
        </LanguageProvider>
    );
}

function AuthGate() {
    const workspace = useWorkspace();
    const router = useRouter();
    const segments = useSegments();
    const didRestoreSession = useRef(false);

    useEffect(() => {
        if (didRestoreSession.current) return;
        didRestoreSession.current = true;
        void workspace.restoreSession();
        // Only ever runs once, on mount — restoreSession is intentionally
        // excluded from deps since useEcampusWorkspace() returns a fresh
        // object every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!workspace.isReady) return;

        const inAuthenticatedArea = segments[0] === '(tabs)';
        if (!workspace.isAuthenticated && inAuthenticatedArea) {
            router.replace('/login');
            return;
        }

        if (workspace.isAuthenticated && !inAuthenticatedArea) {
            router.replace('/');
        }
    }, [workspace.isReady, workspace.isAuthenticated, segments, router]);

    if (!workspace.isReady) return <BootPage />;

    return <Slot />;
}

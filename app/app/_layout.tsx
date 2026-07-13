import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
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

// If the app/tab sat in the background longer than this, the session is
// worth re-checking against the server on return instead of trusting
// whatever's still in memory — the eCampus token could easily have expired
// in the meantime, and eCampus itself could be unreachable/down.
const STALE_AFTER_MS = 2 * 60 * 1000;

function AuthGate() {
    const workspace = useWorkspace();
    const router = useRouter();
    const segments = useSegments();
    const didRestoreSession = useRef(false);
    const lastActiveAtRef = useRef(Date.now());

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
        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (nextState !== 'active') {
                lastActiveAtRef.current = Date.now();
                return;
            }

            const awayMs = Date.now() - lastActiveAtRef.current;
            lastActiveAtRef.current = Date.now();

            if (awayMs > STALE_AFTER_MS && workspace.isAuthenticated) {
                void workspace.restoreSession();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspace.isAuthenticated]);

    // The owner's admin dashboard has its own separate auth (not eCampus/CPF)
    // and must never be redirected by the student login gate below.
    const isAdminRoute = segments[0] === 'admin';
    const inAuthenticatedArea = segments[0] === '(tabs)';
    // True for exactly one render right after isReady flips true when the
    // landing URL doesn't match the auth state (e.g. opening "/" — which
    // resolves inside the (tabs) group — while logged out). Without this,
    // <Slot/> would mount the authenticated screens for that one render
    // before router.replace() below catches up, and their own mount effects
    // (dashboard prefetch, etc.) would fire against a session that doesn't
    // exist — surfacing a confusing "session expired" error on a user who
    // was never logged in.
    const authAreaMismatch = !isAdminRoute && workspace.isReady
        && ((!workspace.isAuthenticated && inAuthenticatedArea) || (workspace.isAuthenticated && !inAuthenticatedArea));

    useEffect(() => {
        if (isAdminRoute || !workspace.isReady) return;

        if (!workspace.isAuthenticated && inAuthenticatedArea) {
            router.replace('/login');
            return;
        }

        if (workspace.isAuthenticated && !inAuthenticatedArea) {
            router.replace('/');
        }
    }, [isAdminRoute, workspace.isReady, workspace.isAuthenticated, inAuthenticatedArea, router]);

    if (isAdminRoute) return <Slot />;
    if (!workspace.isReady || authAreaMismatch) return <BootPage />;

    return <Slot />;
}

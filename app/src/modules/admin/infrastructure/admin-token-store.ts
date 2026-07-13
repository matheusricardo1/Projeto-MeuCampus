// Mirrors async-auth-session-store.ts's storage strategy (sessionStorage on
// web, in-memory fallback elsewhere) but under its own key — the admin token
// must never share storage with the student's eCampus session.
let cachedToken: string | null = null;
const STORAGE_KEY = 'admin.token';

function hasSessionStorage(): boolean {
    return typeof sessionStorage !== 'undefined';
}

export function getAdminToken(): string | null {
    if (!hasSessionStorage()) return cachedToken;
    return sessionStorage.getItem(STORAGE_KEY);
}

export function setAdminToken(token: string): void {
    if (!hasSessionStorage()) {
        cachedToken = token;
        return;
    }
    sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearAdminToken(): void {
    cachedToken = null;
    if (hasSessionStorage()) sessionStorage.removeItem(STORAGE_KEY);
}

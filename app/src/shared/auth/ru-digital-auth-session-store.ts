import type { AuthSession } from '@/shared/auth/auth-session';

// A separate session from eCampus's (see AsyncAuthSessionStore) — RU Digital
// has its own login/JWT on the API side, so its token is tracked
// independently instead of overloading the eCampus session slot.
let cachedSession: AuthSession | null = null;
const STORAGE_KEY = 'ru-digital.auth-session';

function hasSessionStorage(): boolean {
    return typeof sessionStorage !== 'undefined';
}

function readStoredSession(): AuthSession | null {
    if (!hasSessionStorage()) {
        return cachedSession;
    }

    const rawValue = sessionStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
        return null;
    }

    try {
        return JSON.parse(rawValue) as AuthSession;
    } catch {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

function writeStoredSession(session: AuthSession | null): void {
    if (!hasSessionStorage()) {
        cachedSession = session;
        return;
    }

    if (!session) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export class RuDigitalAuthSessionStore {
    async get(): Promise<AuthSession | null> {
        return readStoredSession();
    }

    async save(session: AuthSession): Promise<void> {
        writeStoredSession(session);
    }

    async clear(): Promise<void> {
        writeStoredSession(null);
        cachedSession = null;
    }
}

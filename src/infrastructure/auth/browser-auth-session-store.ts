import type { AuthSession } from '@/domain/entities/auth-session';
import type { AuthSessionStore } from '@/application/ports/auth-session-store';

const STORAGE_KEY = 'ufam-academics.ecampus.session';

export class BrowserAuthSessionStore implements AuthSessionStore {
    get(): AuthSession | null {
        if (typeof window === 'undefined') return null;

        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        try {
            return JSON.parse(raw) as AuthSession;
        } catch {
            this.clear();
            return null;
        }
    }

    save(session: AuthSession): void {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }

    clear(): void {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(STORAGE_KEY);
        }
    }
}

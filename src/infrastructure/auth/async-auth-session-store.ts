import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthSession } from '@/domain/entities/auth-session';
import type { AuthSessionStore } from '@/application/ports/auth-session-store';

const STORAGE_KEY = 'ufam-academics.ecampus.session';

export class AsyncAuthSessionStore implements AuthSessionStore {
    async get(): Promise<AuthSession | null> {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        try {
            return JSON.parse(raw) as AuthSession;
        } catch {
            await this.clear();
            return null;
        }
    }

    async save(session: AuthSession): Promise<void> {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }

    async clear(): Promise<void> {
        await AsyncStorage.removeItem(STORAGE_KEY);
    }
}

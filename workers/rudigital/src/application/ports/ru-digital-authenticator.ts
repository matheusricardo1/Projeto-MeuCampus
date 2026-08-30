import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';

export interface RuDigitalAuthenticator {
    /** Logs in and returns the session data to persist (the `session_token` JWT). */
    authenticate(credentials: RuDigitalCredentials, password: string): Promise<Record<string, unknown>>;
}

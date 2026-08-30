export interface RuDigitalCredentials {
    cpf: string;
    /** The RU Digital `session_token` JWT scraped by the worker. */
    session?: Record<string, unknown>;
}

export class AuthSessionExpiredError extends Error {
    constructor(message = 'Sessao expirada.') {
        super(message);
        this.name = 'AuthSessionExpiredError';
    }
}

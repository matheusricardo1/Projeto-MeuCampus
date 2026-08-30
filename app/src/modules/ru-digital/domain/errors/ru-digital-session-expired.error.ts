export class RuDigitalSessionExpiredError extends Error {
    constructor(message = 'Sua sessao do RU Digital expirou.') {
        super(message);
        this.name = 'RuDigitalSessionExpiredError';
    }
}

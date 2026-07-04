export class ExternalServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExternalServiceError';
    }
}

export class InvalidAcademicRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidAcademicRequestError';
    }
}

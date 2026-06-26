export class InvalidEcampusRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidEcampusRequestError';
    }
}

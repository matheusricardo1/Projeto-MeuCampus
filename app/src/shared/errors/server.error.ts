export class ServerError extends Error {
    readonly status: number;

    constructor(status: number, message = 'O servidor esta com problemas no momento. Tente novamente em instantes.') {
        super(message);
        this.name = 'ServerError';
        this.status = status;
    }
}

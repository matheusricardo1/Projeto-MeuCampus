export class InvalidAiMessageException extends Error {
    constructor(message = 'Mensagem invalida.') {
        super(message);
        this.name = 'InvalidAiMessageException';
    }
}

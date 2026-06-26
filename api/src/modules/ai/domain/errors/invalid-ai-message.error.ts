export class InvalidAiMessageError extends Error {
    constructor(message = 'Mensagem invalida.') {
        super(message);
        this.name = 'InvalidAiMessageError';
    }
}

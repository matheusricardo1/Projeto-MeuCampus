import { DomainException } from '@/shared/domain/domain.exception';

export class InvalidAiMessageException extends DomainException {
    constructor(message = 'Mensagem invalida.') {
        super(message);
        this.name = 'InvalidAiMessageException';
    }
}

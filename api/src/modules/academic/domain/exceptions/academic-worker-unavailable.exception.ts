import { DomainException } from '@academic/domain/exceptions/domain.exception';

export class AcademicWorkerUnavailableException extends DomainException {
    constructor() {
        super('O servico esta temporariamente indisponivel. Tente novamente em instantes.');
        this.name = 'AcademicWorkerUnavailableException';
    }
}

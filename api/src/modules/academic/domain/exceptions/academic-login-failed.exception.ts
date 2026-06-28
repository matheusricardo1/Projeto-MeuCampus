import { DomainException } from '@academic/domain/exceptions/domain.exception';

export class AcademicLoginFailedException extends DomainException {
    constructor() {
        super('CPF ou senha invalidos.');
        this.name = 'AcademicLoginFailedException';
    }
}

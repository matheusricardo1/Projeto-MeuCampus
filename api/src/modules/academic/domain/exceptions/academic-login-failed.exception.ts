import { DomainException } from '@/shared/domain/domain.exception';

export class AcademicLoginFailedException extends DomainException {
    constructor() {
        super('CPF ou senha invalidos.');
        this.name = 'AcademicLoginFailedException';
    }
}

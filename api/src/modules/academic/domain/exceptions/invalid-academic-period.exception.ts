import { DomainException } from '@/shared/domain/domain.exception';

export class InvalidAcademicYearException extends DomainException {
    constructor(message = 'Informe um ano dentro do periodo aceito.') {
        super(message);
        this.name = 'InvalidAcademicYearException';
    }
}

export class InvalidAcademicPeriodException extends DomainException {
    constructor() {
        super('Informe um periodo valido.');
        this.name = 'InvalidAcademicPeriodException';
    }
}

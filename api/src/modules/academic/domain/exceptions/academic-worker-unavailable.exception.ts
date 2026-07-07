import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@/shared/domain/domain.exception';

export class AcademicWorkerUnavailableException extends DomainException {
    constructor() {
        super('O servico esta temporariamente indisponivel. Tente novamente em instantes.', HttpStatus.SERVICE_UNAVAILABLE);
        this.name = 'AcademicWorkerUnavailableException';
    }
}

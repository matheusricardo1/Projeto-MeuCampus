import { DomainException } from '@/shared/domain/domain.exception';

export class InvalidAcademicRequestError extends DomainException {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidAcademicRequestError';
    }
}

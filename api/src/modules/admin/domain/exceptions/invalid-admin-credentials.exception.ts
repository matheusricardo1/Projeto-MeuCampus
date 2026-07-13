import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@/shared/domain/domain.exception';

export class InvalidAdminCredentialsException extends DomainException {
    constructor() {
        super('Email ou senha invalidos.', HttpStatus.UNAUTHORIZED);
        this.name = 'InvalidAdminCredentialsException';
    }
}

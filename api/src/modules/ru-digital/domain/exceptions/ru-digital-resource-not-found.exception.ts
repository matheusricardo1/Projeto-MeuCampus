import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@/shared/domain/domain.exception';
import type { RuDigitalResource } from '@ru-digital/domain/value-objects/ru-digital-resource.value-object';

export class RuDigitalResourceNotFoundException extends DomainException {
    constructor(public readonly resource: RuDigitalResource) {
        super(`No cached result for ${resource}.`, HttpStatus.NOT_FOUND);
        this.name = 'RuDigitalResourceNotFoundException';
    }
}

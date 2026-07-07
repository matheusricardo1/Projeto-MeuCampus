import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@/shared/domain/domain.exception';
import type { AcademicResource } from '@academic/domain/value-objects/academic-resource.value-object';

export class AcademicResourceNotFoundException extends DomainException {
    constructor(public readonly resource: AcademicResource) {
        super(`No cached result for ${resource}.`, HttpStatus.NOT_FOUND);
        this.name = 'AcademicResourceNotFoundException';
    }
}

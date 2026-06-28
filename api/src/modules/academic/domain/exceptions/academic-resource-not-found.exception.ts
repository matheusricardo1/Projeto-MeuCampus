import { DomainException } from '@academic/domain/exceptions/domain.exception';
import type { AcademicResource } from '@academic/domain/value-objects/academic-resource.value-object';

export class AcademicResourceNotFoundException extends DomainException {
    constructor(public readonly resource: AcademicResource) {
        super(`No cached result for ${resource}.`);
        this.name = 'AcademicResourceNotFoundException';
    }
}

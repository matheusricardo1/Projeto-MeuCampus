import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@/shared/domain/domain.exception';
import type { MoodleResource } from '@moodle/domain/value-objects/moodle-resource.value-object';

export class MoodleResourceNotFoundException extends DomainException {
    constructor(public readonly resource: MoodleResource) {
        super(`No cached result for ${resource}.`, HttpStatus.NOT_FOUND);
        this.name = 'MoodleResourceNotFoundException';
    }
}

import { HttpStatus } from '@nestjs/common';

export abstract class DomainException extends Error {
    protected constructor(message: string, public readonly statusCode: number = HttpStatus.BAD_REQUEST) {
        super(message);
    }
}

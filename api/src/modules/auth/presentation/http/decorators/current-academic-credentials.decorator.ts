import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';

interface RequestWithAcademicCredentials {
    academicCredentials?: AcademicCredentials;
}

export const CurrentAcademicCredentials = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AcademicCredentials => {
        const request = context.switchToHttp().getRequest<RequestWithAcademicCredentials>();
        if (!request.academicCredentials) {
            throw new Error('Attempted to access protected route without auth.');
        }

        return request.academicCredentials;
    }
);

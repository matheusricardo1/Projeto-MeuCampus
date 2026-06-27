import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AcademicCredentials } from '@academic/domain/models/academic-credentials';

export const CurrentAcademicCredentials = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AcademicCredentials => {
        const request = context.switchToHttp().getRequest<{ academicCredentials: AcademicCredentials }>();
        return request.academicCredentials;
    }
);

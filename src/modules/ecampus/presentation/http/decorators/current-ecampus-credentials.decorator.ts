import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';

export const CurrentEcampusCredentials = createParamDecorator(
    (_data: unknown, context: ExecutionContext): EcampusCredentials => {
        const request = context.switchToHttp().getRequest<{ ecampusCredentials: EcampusCredentials }>();
        return request.ecampusCredentials;
    }
);

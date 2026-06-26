import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AiAuthenticatedUser } from '@ai/domain/models/ai-authenticated-user';

export const CurrentAiUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AiAuthenticatedUser => {
        const request = context.switchToHttp().getRequest<{ aiUser: AiAuthenticatedUser }>();
        return request.aiUser;
    }
);

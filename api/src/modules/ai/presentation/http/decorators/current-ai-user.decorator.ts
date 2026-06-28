import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AiAuthenticatedUser } from '@ai/domain/entities/ai-authenticated-user.entity';

export const CurrentAiUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AiAuthenticatedUser => {
        const request = context.switchToHttp().getRequest<{ aiUser: AiAuthenticatedUser }>();
        return request.aiUser;
    }
);

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';

interface RequestWithRuDigitalCredentials {
    ruDigitalCredentials?: RuDigitalCredentials;
}

export const CurrentRuDigitalCredentials = createParamDecorator(
    (_data: unknown, context: ExecutionContext): RuDigitalCredentials => {
        const request = context.switchToHttp().getRequest<RequestWithRuDigitalCredentials>();
        if (!request.ruDigitalCredentials) {
            throw new Error('Attempted to access protected route without auth.');
        }

        return request.ruDigitalCredentials;
    }
);
